import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://motionlesstern-n8n.cloudfy.live/webhook/5acbbf43-ed70-4111-9049-b88bca8370a9";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Concatenate all agent instruction fields into a single formatted text block
function buildSystemMessage(agent: any): string {
  const sections: string[] = [];

  if (agent.nome) {
    sections.push(`## Nome do Agente\n${agent.nome}`);
  }

  if (agent.quem_eh) {
    sections.push(`## Quem é o Agente\n${agent.quem_eh}`);
  }

  if (agent.o_que_faz) {
    sections.push(`## O que o Agente Faz\n${agent.o_que_faz}`);
  }

  if (agent.objetivo) {
    sections.push(`## Objetivo do Agente\n${agent.objetivo}`);
  }

  if (agent.como_deve_responder) {
    sections.push(`## Como Deve Responder\n${agent.como_deve_responder}`);
  }

  if (agent.instrucoes_agente) {
    sections.push(`## Instruções do Agente\n${agent.instrucoes_agente}`);
  }

  if (agent.topicos_evitar) {
    sections.push(`## Tópicos a Evitar\n${agent.topicos_evitar}`);
  }

  if (agent.palavras_evitar) {
    sections.push(`## Palavras a Evitar\n${agent.palavras_evitar}`);
  }

  if (agent.links_permitidos) {
    sections.push(`## Links Permitidos\n${agent.links_permitidos}`);
  }

  if (agent.regras_personalizadas) {
    sections.push(`## Regras Personalizadas\n${agent.regras_personalizadas}`);
  }

  if (agent.resposta_padrao_erro) {
    sections.push(`## Resposta Padrão de Erro\n${agent.resposta_padrao_erro}`);
  }

  if (agent.resposta_secundaria_erro) {
    sections.push(`## Resposta Secundária de Erro\n${agent.resposta_secundaria_erro}`);
  }

  return sections.join('\n\n');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { agentId } = await req.json();
    console.log(`Syncing agent ${agentId} to n8n for user ${user.id}`);

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single();

    if (agentError || !agent) {
      console.error('Agent error:', agentError);
      throw new Error('Agent not found or access denied');
    }

    // Get the WhatsApp instance for this agent (if exists)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, phone_number, status')
      .eq('agent_id', agentId)
      .maybeSingle();

    // Build the concatenated system message
    const systemMessage = buildSystemMessage(agent);

    // Prepare payload for n8n webhook
    const payload = {
      agent_id: agent.id,
      agent_name: agent.nome,
      user_id: user.id,
      user_email: user.email,
      instance_name: instance?.instance_name || null,
      phone_number: instance?.phone_number || null,
      whatsapp_status: instance?.status || 'disconnected',
      system_message: systemMessage,
      updated_at: new Date().toISOString(),
    };

    console.log('Sending payload to n8n:', JSON.stringify(payload, null, 2));

    // Send to n8n webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', response.status, errorText);
      throw new Error(`Failed to sync with n8n: ${response.status}`);
    }

    const result = await response.json().catch(() => ({}));
    console.log('n8n response:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Agent synced to n8n successfully',
      instance_name: instance?.instance_name || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error syncing agent to n8n:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
