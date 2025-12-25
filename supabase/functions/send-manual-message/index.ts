import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { conversation_id, content } = await req.json();

    if (!conversation_id || !content) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('*, agent:agents(*)')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('Error fetching conversation:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp instance for this agent
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('agent_id', conversation.agent_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (instanceError || !instance) {
      console.error('Error fetching instance:', instanceError);
      return new Response(
        JSON.stringify({ error: 'No connected WhatsApp instance found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract phone number from remote_jid
    const toNumber = conversation.remote_jid.split('@')[0];

    // Send message via Evolution API
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Evolution API not configured');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending manual message to ${toNumber} via instance ${instance.instance_name}`);

    const evolutionResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: toNumber,
        textMessage: { text: content },
        options: {
          presence: 'composing',
          linkPreview: true,
        },
      }),
    });

    const evolutionBody = await evolutionResponse.text();

    if (!evolutionResponse.ok) {
      console.error('Evolution API error:', evolutionResponse.status, evolutionBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send message via WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse Evolution response to get message ID
    let messageId = null;
    try {
      const parsed = JSON.parse(evolutionBody);
      messageId = parsed?.key?.id || parsed?.id || null;
    } catch {
      console.log('Could not parse Evolution response for message ID');
    }

    // Save the message to database with sender_type = 'human'
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id,
        message_id: messageId,
        content,
        is_from_me: true,
        message_type: 'text',
        sender_type: 'human',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving message:', saveError);
      // Message was sent but not saved - still return success
    }

    // Update conversation last_message
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    console.log('Manual message sent and saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: savedMessage || { content, sender_type: 'human' }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-manual-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
