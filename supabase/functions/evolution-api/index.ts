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

// Helper function to sanitize names for instance naming
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 30); // Limit length
}

// Generate instance name: {user_name}_{agent_name}_{short_id}
function generateInstanceName(userName: string, agentName: string, agentId: string): string {
  const sanitizedUser = sanitizeName(userName || 'user');
  const sanitizedAgent = sanitizeName(agentName || 'agent');
  const shortId = agentId.substring(0, 8);
  return `${sanitizedUser}_${sanitizedAgent}_${shortId}`;
}

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

    const { action, agentId } = await req.json();
    console.log(`Action: ${action}, AgentId: ${agentId}`);

    // Verify user owns the agent and get user profile
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

    // Get user profile for naming
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle();

    const userName = profile?.nome || user.email?.split('@')[0] || 'user';
    const agentName = agent.nome || 'agent';
    const instanceName = generateInstanceName(userName, agentName, agentId);
    
    console.log(`Generated instance name: ${instanceName}`);

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

  // Configure webhook for this instance
  console.log(`Configuring webhook for instance: ${instanceName}`);
  const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook`;
  
  const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: true,
      events: [
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
        "MESSAGES_UPSERT"
      ],
    }),
  });

  const webhookData = await webhookResponse.json();
  console.log('Evolution API webhook response:', JSON.stringify(webhookData));

  if (!webhookResponse.ok) {
    console.error('Failed to configure webhook, but instance was created');
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
  
  // First, try to restart the instance to generate a new QR code
  console.log(`Restarting instance to generate QR code: ${instanceName}`);
  const restartResponse = await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
    method: 'PUT',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });
  
  const restartData = await restartResponse.json();
  console.log('Evolution API restart response:', JSON.stringify(restartData));
  
  // Wait a moment for the instance to restart
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now try to connect to get QR code
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

  // Check if we got a QR code
  const qrBase64 = data.base64 || data.qrcode?.base64;
  
  if (qrBase64) {
    // Update database with new QR code
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrBase64,
        qr_code_expires_at: new Date(Date.now() + 45000).toISOString(),
        status: 'qr_pending',
      })
      .eq('agent_id', agentId);
      
    return { 
      success: true, 
      qrcode: qrBase64,
      code: data.code
    };
  }
  
  // If still no QR code, try fetching from fetchInstances endpoint
  console.log('No QR code from connect, trying fetchInstances...');
  const fetchResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });
  
  const fetchData = await fetchResponse.json();
  console.log('Evolution API fetchInstances response:', JSON.stringify(fetchData));
  
  // Check various possible locations for QR code in response
  let foundQrCode = null;
  if (Array.isArray(fetchData) && fetchData.length > 0) {
    const instanceData = fetchData[0];
    foundQrCode = instanceData.qrcode?.base64 || instanceData.qr?.base64;
  }
  
  if (foundQrCode) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: foundQrCode,
        qr_code_expires_at: new Date(Date.now() + 45000).toISOString(),
        status: 'qr_pending',
      })
      .eq('agent_id', agentId);
  }

  return { 
    success: true, 
    qrcode: foundQrCode,
    code: data.code,
    message: foundQrCode ? undefined : 'QR code may take a moment to generate. Please try again.'
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
