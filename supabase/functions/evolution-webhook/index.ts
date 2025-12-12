import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// n8n webhook URL for forwarding WhatsApp messages
const N8N_MESSAGES_WEBHOOK_URL = "https://motionlesstern-n8n.cloudfy.live/webhook/5acbbf43-ed70-4111-9049-b88bca8370a9";

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
        console.log('Message received for instance:', instance, '- forwarding to n8n');
        await forwardMessageToN8N(whatsappInstance, payload);
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
  
  const state = data.state?.toLowerCase();
  const currentStatus = instance.status;
  
  // IGNORE statusReason 405 completely - this is a temporary reconnection cycle
  // Evolution API sends these constantly even when connection is active
  if (data.statusReason === 405) {
    console.log('Ignoring 405 status - temporary reconnection cycle, keeping current status:', currentStatus);
    return;
  }
  
  // IGNORE 'connecting' events if we're already connected or were recently connected
  // Evolution API sends these in loops even when connection is stable
  if (state === 'connecting' && (currentStatus === 'connected' || currentStatus === 'connecting')) {
    console.log('Ignoring connecting event - already in stable state:', currentStatus);
    return;
  }
  
  let status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending' = currentStatus || 'disconnected';
  
  // Only update status for definitive state changes
  if (state === 'open' || state === 'connected') {
    status = 'connected';
  } else if (state === 'qrcode') {
    status = 'qr_pending';
  } else if (state === 'connecting' && currentStatus === 'disconnected') {
    // Only set to connecting if we were truly disconnected
    status = 'connecting';
  }
  // Note: We NO LONGER set to 'disconnected' from webhook events
  // The only way to disconnect should be explicit user action or QR timeout
  
  // Don't update if status hasn't changed
  if (status === currentStatus) {
    console.log('Status unchanged, skipping update:', status);
    return;
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

async function forwardMessageToN8N(instance: any, payload: any) {
  try {
    console.log('Forwarding message to n8n webhook...');
    console.log('Instance:', instance.instance_name);
    console.log('Payload:', JSON.stringify(payload));
    
    const response = await fetch(N8N_MESSAGES_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        instance_name: instance.instance_name,
        agent_id: instance.agent_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', response.status, errorText);
    } else {
      console.log('Message forwarded to n8n successfully');
    }
  } catch (error) {
    console.error('Error forwarding message to n8n:', error);
  }
}