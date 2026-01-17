import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

interface MetaCredentials {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

// Validate META API credentials by making a test call
async function validateMetaCredentials(credentials: MetaCredentials): Promise<{
  valid: boolean;
  phoneNumber?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  error?: string;
}> {
  try {
    // Test the access token by fetching phone number details
    const response = await fetch(
      `${META_GRAPH_API_URL}/${credentials.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('META API validation error:', error);
      return {
        valid: false,
        error: error.error?.message || 'Credenciais inválidas',
      };
    }

    const data = await response.json();
    console.log('META API validation success:', data);

    // Also verify WABA ID
    const wabaResponse = await fetch(
      `${META_GRAPH_API_URL}/${credentials.wabaId}?fields=name,currency,timezone_id`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      }
    );

    if (!wabaResponse.ok) {
      const error = await wabaResponse.json();
      console.error('WABA validation error:', error);
      return {
        valid: false,
        error: error.error?.message || 'WABA ID inválido',
      };
    }

    return {
      valid: true,
      phoneNumber: data.display_phone_number?.replace(/\D/g, ''),
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    };
  } catch (error) {
    console.error('Error validating META credentials:', error);
    return {
      valid: false,
      error: 'Erro ao validar credenciais. Verifique sua conexão.',
    };
  }
}

// Send a test message via META API
async function sendTestMessage(
  phoneNumberId: string,
  accessToken: string,
  toNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${META_GRAPH_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toNumber,
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Erro ao enviar mensagem de teste',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending test message:', error);
    return {
      success: false,
      error: 'Erro ao enviar mensagem de teste',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, agentId, credentials } = await req.json();

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id, nome')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (agent.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para este agente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'connect': {
        if (!credentials) {
          return new Response(
            JSON.stringify({ error: 'Credenciais não fornecidas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate credentials with META API
        const validation = await validateMetaCredentials(credentials);

        if (!validation.valid) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: validation.error 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if instance already exists
        const { data: existing } = await supabase
          .from('meta_whatsapp_instances')
          .select('id')
          .eq('agent_id', agentId)
          .single();

        if (existing) {
          // Update existing instance
          const { error: updateError } = await supabase
            .from('meta_whatsapp_instances')
            .update({
              waba_id: credentials.wabaId,
              phone_number_id: credentials.phoneNumberId,
              access_token: credentials.accessToken,
              business_account_id: credentials.businessAccountId || null,
              status: 'connected',
              phone_number: validation.phoneNumber,
              display_phone_number: validation.displayPhoneNumber,
              verified_name: validation.verifiedName,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Error updating META instance:', updateError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao atualizar instância' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Create new instance
          const { error: insertError } = await supabase
            .from('meta_whatsapp_instances')
            .insert({
              agent_id: agentId,
              waba_id: credentials.wabaId,
              phone_number_id: credentials.phoneNumberId,
              access_token: credentials.accessToken,
              business_account_id: credentials.businessAccountId || null,
              status: 'connected',
              phone_number: validation.phoneNumber,
              display_phone_number: validation.displayPhoneNumber,
              verified_name: validation.verifiedName,
            });

          if (insertError) {
            console.error('Error creating META instance:', insertError);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao criar instância' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Conectado com sucesso à API Oficial da META',
            data: {
              phoneNumber: validation.phoneNumber,
              displayPhoneNumber: validation.displayPhoneNumber,
              verifiedName: validation.verifiedName,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_status': {
        const { data: instance, error: instanceError } = await supabase
          .from('meta_whatsapp_instances')
          .select('*')
          .eq('agent_id', agentId)
          .single();

        if (instanceError || !instance) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              connected: false,
              data: null 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify credentials are still valid
        const validation = await validateMetaCredentials({
          wabaId: instance.waba_id,
          phoneNumberId: instance.phone_number_id,
          accessToken: instance.access_token,
        });

        if (!validation.valid) {
          // Update status to error
          await supabase
            .from('meta_whatsapp_instances')
            .update({
              status: 'error',
              error_message: validation.error,
            })
            .eq('id', instance.id);

          return new Response(
            JSON.stringify({
              success: true,
              connected: false,
              status: 'error',
              error: validation.error,
              data: {
                displayPhoneNumber: instance.display_phone_number,
                verifiedName: instance.verified_name,
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            connected: true,
            status: instance.status,
            data: {
              phoneNumber: instance.phone_number,
              displayPhoneNumber: instance.display_phone_number,
              verifiedName: instance.verified_name,
              wabaId: instance.waba_id,
              phoneNumberId: instance.phone_number_id,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        const { error: deleteError } = await supabase
          .from('meta_whatsapp_instances')
          .delete()
          .eq('agent_id', agentId);

        if (deleteError) {
          console.error('Error disconnecting META instance:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao desconectar' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Desconectado com sucesso' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_message': {
        const { data: instance } = await supabase
          .from('meta_whatsapp_instances')
          .select('*')
          .eq('agent_id', agentId)
          .single();

        if (!instance) {
          return new Response(
            JSON.stringify({ success: false, error: 'Instância não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { toNumber } = await req.json();
        const result = await sendTestMessage(
          instance.phone_number_id,
          instance.access_token,
          toNumber
        );

        return new Response(
          JSON.stringify(result),
          { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in meta-whatsapp-api:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
