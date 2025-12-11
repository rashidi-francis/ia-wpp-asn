import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const { data: { user }, error: userError } = await createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, agentId, instanceName } = await req.json();
    console.log(`Action: ${action}, AgentId: ${agentId}, InstanceName: ${instanceName}`);

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, nome, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentError || !agent) {
      console.error('Agent error:', agentError);
      throw new Error('Agent not found or access denied');
    }

    let result;

    switch (action) {
      case 'create_instance':
        result = await createInstance(supabase, agent, instanceName);
        break;
      case 'get_qrcode':
        result = await getQRCode(supabase, agentId, instanceName);
        break;
      case 'get_status':
        result = await getInstanceStatus(supabase, agentId, instanceName);
        break;
      case 'disconnect':
        result = await disconnectInstance(supabase, agentId, instanceName);
        break;
      case 'delete_instance':
        result = await deleteInstance(supabase, agentId, instanceName);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createInstance(supabase: any, agent: any, instanceName: string) {
  console.log(`Creating instance: ${instanceName}`);
  
  // Create instance in Evolution API
  const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({
      instanceName: instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });

  const data = await response.json();
  console.log('Evolution API create response:', JSON.stringify(data));

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create instance');
  }

  // Save to database
  const { error: dbError } = await supabase
    .from('whatsapp_instances')
    .upsert({
      agent_id: agent.id,
      instance_name: instanceName,
      status: 'qr_pending',
      evolution_instance_id: data.instance?.instanceName || instanceName,
      qr_code: data.qrcode?.base64 || null,
      qr_code_expires_at: data.qrcode?.base64 ? new Date(Date.now() + 45000).toISOString() : null,
    }, {
      onConflict: 'agent_id'
    });

  if (dbError) {
    console.error('Database error:', dbError);
    throw new Error('Failed to save instance');
  }

  return { 
    success: true, 
    qrcode: data.qrcode?.base64,
    instanceName: instanceName 
  };
}

async function getQRCode(supabase: any, agentId: string, instanceName: string) {
  console.log(`Getting QR code for instance: ${instanceName}`);
  
  // Connect to get QR code
  const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });

  const data = await response.json();
  console.log('Evolution API connect response:', JSON.stringify(data));

  if (!response.ok) {
    throw new Error(data.message || 'Failed to get QR code');
  }

  // Update database with new QR code
  if (data.base64) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: data.base64,
        qr_code_expires_at: new Date(Date.now() + 45000).toISOString(),
        status: 'qr_pending',
      })
      .eq('agent_id', agentId);
  }

  return { 
    success: true, 
    qrcode: data.base64,
    code: data.code
  };
}

async function getInstanceStatus(supabase: any, agentId: string, instanceName: string) {
  console.log(`Getting status for instance: ${instanceName}`);
  
  const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });

  const data = await response.json();
  console.log('Evolution API status response:', JSON.stringify(data));

  let status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending' = 'disconnected';
  
  if (data.state === 'open' || data.instance?.state === 'open') {
    status = 'connected';
  } else if (data.state === 'connecting' || data.instance?.state === 'connecting') {
    status = 'connecting';
  } else if (data.state === 'close' || data.instance?.state === 'close') {
    status = 'disconnected';
  }

  // Update database
  await supabase
    .from('whatsapp_instances')
    .update({ 
      status,
      phone_number: data.instance?.profilePictureUrl ? data.instance?.owner : null,
    })
    .eq('agent_id', agentId);

  return { 
    success: true, 
    status,
    state: data.state || data.instance?.state 
  };
}

async function disconnectInstance(supabase: any, agentId: string, instanceName: string) {
  console.log(`Disconnecting instance: ${instanceName}`);
  
  const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });

  const data = await response.json();
  console.log('Evolution API logout response:', JSON.stringify(data));

  // Update database
  await supabase
    .from('whatsapp_instances')
    .update({ 
      status: 'disconnected',
      qr_code: null,
      qr_code_expires_at: null,
      phone_number: null,
    })
    .eq('agent_id', agentId);

  return { success: true };
}

async function deleteInstance(supabase: any, agentId: string, instanceName: string) {
  console.log(`Deleting instance: ${instanceName}`);
  
  // Delete from Evolution API
  const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });

  const data = await response.json();
  console.log('Evolution API delete response:', JSON.stringify(data));

  // Delete from database
  await supabase
    .from('whatsapp_instances')
    .delete()
    .eq('agent_id', agentId);

  return { success: true };
}
