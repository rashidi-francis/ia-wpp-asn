import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plan mapping based on amount (in centavos)
const planMapping: Record<number, { name: string; billingType: string }> = {
  5990: { name: 'Básico', billingType: 'monthly' },
  65800: { name: 'Básico', billingType: 'annual' },
  17970: { name: 'Avançado', billingType: 'monthly' },
  197600: { name: 'Avançado', billingType: 'annual' },
  35940: { name: 'Empresarial', billingType: 'monthly' },
  395300: { name: 'Empresarial', billingType: 'annual' },
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Verify it's an order.paid event
    if (payload.type !== 'order.paid') {
      console.log('Ignoring non-payment event:', payload.type);
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = payload.data;
    const orderId = order.id;
    const amount = order.amount;
    const customerEmail = order.customer?.email;

    if (!customerEmail) {
      console.error('No customer email in webhook');
      return new Response(JSON.stringify({ error: 'No customer email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get plan info from amount
    const planInfo = planMapping[amount];
    if (!planInfo) {
      console.error('Unknown amount:', amount);
      return new Response(JSON.stringify({ error: 'Unknown plan amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing payment for:', customerEmail, 'Plan:', planInfo.name);

    // Find user by email in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', customerEmail)
      .maybeSingle();

    if (profileError) {
      console.error('Error finding profile:', profileError);
      return new Response(JSON.stringify({ error: 'Profile lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile) {
      console.error('No profile found for email:', customerEmail);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if payment already processed
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('pagarme_order_id', orderId)
      .maybeSingle();

    if (existingPayment) {
      console.log('Payment already processed:', orderId);
      return new Response(JSON.stringify({ message: 'Payment already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate expiration date based on billing type
    const now = new Date();
    let expiresAt: Date;
    if (planInfo.billingType === 'annual') {
      expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
    } else {
      expiresAt = new Date(now.setMonth(now.getMonth() + 1));
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: profile.id,
        pagarme_order_id: orderId,
        plan_name: planInfo.name,
        amount: amount,
        status: 'paid',
        billing_type: planInfo.billingType,
        paid_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      return new Response(JSON.stringify({ error: 'Payment record failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update user's plan and expiration date
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        plano: planInfo.name,
        plan_expires_at: expiresAt.toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Error updating profile plan:', updateError);
      return new Response(JSON.stringify({ error: 'Plan update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully processed payment and updated plan for:', customerEmail);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment processed and plan updated',
      plan: planInfo.name 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});