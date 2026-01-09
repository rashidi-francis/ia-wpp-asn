import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const N8N_MESSAGES_WEBHOOK_URL = "https://motionlesstern-n8n.cloudfy.live/webhook/5ca49874-447c-46fc-9e4a-3a2bc8f98afd";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { remote_jid } = await req.json();

    console.log('Testing follow-up for:', remote_jid);

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('*, agents(*)')
      .eq('remote_jid', remote_jid)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get followup settings
    const { data: followupSettings } = await supabase
      .from('agent_followup_settings')
      .select('*')
      .eq('agent_id', conversation.agent_id)
      .single();

    // Get instance
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('agent_id', conversation.agent_id)
      .single();

    // Get last message
    const { data: lastMessage } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const diagnostics = {
      conversation: {
        id: conversation.id,
        remote_jid: conversation.remote_jid,
        agent_enabled: conversation.agent_enabled,
        last_message_at: conversation.last_message_at,
      },
      followup: {
        enabled: followupSettings?.enabled,
        delay: followupSettings?.delay_type,
        message: followupSettings?.custom_message?.substring(0, 50),
      },
      instance: {
        name: instance?.instance_name,
        status: instance?.status,
      },
      last_message: {
        content: lastMessage?.content?.substring(0, 50),
        is_from_me: lastMessage?.is_from_me,
        created_at: lastMessage?.created_at,
      },
      time_since_last: lastMessage?.created_at
        ? Math.floor((Date.now() - new Date(lastMessage.created_at).getTime()) / 60000)
        : null,
    };

    console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));

    // Force send follow-up to n8n
    const testPayload = {
      instance_name: instance?.instance_name,
      instance_id: instance?.id,
      agent_id: conversation.agent_id,
      phone_number: instance?.phone_number,
      message: '[TEST FOLLOW-UP]',
      prompt: conversation.agents?.nome || '',
      followup_enabled: true,
      followup_delay: '30min',
      followup_message: followupSettings?.custom_message || 'Teste de follow-up',
      data: {
        key: { remoteJid: remote_jid },
        remoteJid: remote_jid,
        messageType: 'conversation',
        message: { conversation: '[TEST]' },
      },
    };

    const n8nResponse = await fetch(N8N_MESSAGES_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    const n8nResult = await n8nResponse.text();

    return new Response(JSON.stringify({ 
      success: true, 
      diagnostics,
      n8n_status: n8nResponse.status,
      n8n_response: n8nResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
