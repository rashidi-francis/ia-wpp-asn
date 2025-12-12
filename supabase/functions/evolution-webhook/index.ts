import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const payload = await req.json();
    
    console.log('Webhook received:', JSON.stringify(payload));

    const { event, instance, data } = payload;

    if (!instance) {
      console.log('No instance in webhook payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the instance in database
    const { data: whatsappInstance, error: findError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instance)
      .maybeSingle();

    if (findError || !whatsappInstance) {
      console.log('Instance not found in database:', instance);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize event name (Evolution API uses different formats)
    const normalizedEvent = event.toLowerCase().replace(/_/g, '.');
    console.log(`Processing event: ${event} (normalized: ${normalizedEvent})`);

    // Handle different events
    switch (normalizedEvent) {
      case 'connection.update':
        await handleConnectionUpdate(supabase, whatsappInstance, data);
        break;
      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, whatsappInstance, data);
        break;
      case 'messages.upsert':
        console.log('Message received for instance:', instance);
        break;
      default:
        console.log('Unhandled event:', event);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleConnectionUpdate(supabase: any, instance: any, data: any) {
  console.log('Connection update:', JSON.stringify(data));
  
  let status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending' = 'disconnected';
  
  // Map Evolution API states to our status
  // Evolution API states: 'open', 'connecting', 'close', 'qrcode'
  const state = data.state?.toLowerCase();
  
  if (state === 'open' || state === 'connected') {
    status = 'connected';
  } else if (state === 'connecting') {
    status = 'connecting';
  } else if (state === 'close' || state === 'disconnected') {
    // Only mark as disconnected if statusReason indicates a real disconnect
    // statusReason 405 can be a temporary state during reconnection
    if (data.statusReason === 405) {
      console.log('Received 405 status - checking if this is a temporary disconnect');
      // Keep current status if it's just a brief reconnection cycle
      const currentStatus = instance.status;
      if (currentStatus === 'connected') {
        console.log('Ignoring brief disconnect, keeping connected status');
        return; // Don't update status for brief disconnects
      }
    }
    status = 'disconnected';
  } else if (state === 'qrcode') {
    status = 'qr_pending';
  }

  const updateData: any = { status };
  
  // Clear QR code when connected
  if (status === 'connected') {
    updateData.qr_code = null;
    updateData.qr_code_expires_at = null;
  }

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('id', instance.id);

  console.log(`Updated instance ${instance.instance_name} status to: ${status}`);
}

async function handleQRCodeUpdate(supabase: any, instance: any, data: any) {
  console.log('QR Code update received:', JSON.stringify(data));
  
  // Try multiple possible paths for base64 QR code
  const base64 = data.qrcode?.base64 || data.base64 || data.qr?.base64 || data.code;
  
  if (base64) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: base64,
        qr_code_expires_at: new Date(Date.now() + 45000).toISOString(),
        status: 'qr_pending',
      })
      .eq('id', instance.id);

    console.log('Updated QR code for instance:', instance.instance_name);
  } else {
    console.log('No base64 QR code found in data');
  }
}
