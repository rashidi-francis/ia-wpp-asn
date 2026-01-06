import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plan pricing in centavos
const planPricing: Record<string, { monthly: number; annual: number }> = {
  'Básico': { monthly: 5990, annual: 65800 },
  'Avançado': { monthly: 17970, annual: 197600 },
  'Empresarial': { monthly: 35940, annual: 395300 },
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pagarmeKey = Deno.env.get('PAGARME_SECRET_KEY');
    if (!pagarmeKey) {
      throw new Error('PAGARME_SECRET_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planName, billingType, successUrl, cancelUrl } = await req.json();

    console.log('Creating checkout for:', user.email, 'Plan:', planName, 'Billing:', billingType);

    if (!planName || !planPricing[planName]) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pricing = planPricing[planName];
    const amount = billingType === 'annual' ? pricing.annual : pricing.monthly;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, email, celular')
      .eq('id', user.id)
      .single();

    // Create Pagar.me checkout
    const checkoutPayload = {
      customer: {
        name: profile?.nome || user.email?.split('@')[0] || 'Cliente',
        email: user.email,
        type: 'individual',
      },
      items: [
        {
          amount: amount,
          description: `Plano ${planName} - ${billingType === 'annual' ? 'Anual' : 'Mensal'}`,
          quantity: 1,
        }
      ],
      payments: [
        {
          payment_method: 'checkout',
          checkout: {
            expires_in: 3600, // 1 hour
            billing_address_editable: false,
            customer_editable: false,
            accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
            success_url: successUrl || 'https://chatasn.lovable.app/dashboard?payment=success',
            skip_checkout_success_page: false,
            credit_card: {
              capture: true,
              statement_descriptor: 'CHATASN',
              installments: [
                { number: 1, total: amount },
                ...(billingType === 'annual' ? [
                  { number: 2, total: amount },
                  { number: 3, total: amount },
                  { number: 6, total: amount },
                  { number: 12, total: amount },
                ] : [])
              ]
            },
            pix: {
              expires_in: 3600,
            },
            boleto: {
              due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
              instructions: 'Pagar até o vencimento'
            }
          }
        }
      ]
    };

    console.log('Sending to Pagar.me:', JSON.stringify(checkoutPayload, null, 2));

    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(pagarmeKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload),
    });

    const result = await response.json();
    
    console.log('Pagar.me response:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('Pagar.me error:', result);
      return new Response(JSON.stringify({ 
        error: 'Failed to create checkout',
        details: result 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get checkout URL from response
    const checkoutUrl = result.checkouts?.[0]?.payment_url || result.url;

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', result);
      return new Response(JSON.stringify({ 
        error: 'No checkout URL returned',
        details: result 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create pending payment record
    const supabaseService = createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseService
      .from('payments')
      .insert({
        user_id: user.id,
        pagarme_order_id: result.id,
        plan_name: planName,
        amount: amount,
        status: 'pending',
        billing_type: billingType,
      });

    return new Response(JSON.stringify({ 
      checkoutUrl,
      orderId: result.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});