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

// Generate sequential instance name: agente01, agente02, etc.
async function generateSequentialInstanceName(supabase: any): Promise<string> {
  // Fetch all existing instance names to find the next number
  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select('instance_name')
    .order('created_at', { ascending: true });
  
  let nextNumber = 1;
  
  if (instances && instances.length > 0) {
    // Extract numbers from existing instance names (agente01, agente02, etc.)
    const existingNumbers = instances
      .map((inst: any) => {
        const match = inst.instance_name?.match(/^agente(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num: number) => num > 0);
    
    if (existingNumbers.length > 0) {
      nextNumber = Math.max(...existingNumbers) + 1;
    }
  }
  
  // Format with leading zero for numbers < 10
  const formattedNumber = nextNumber.toString().padStart(2, '0');
  return `agente${formattedNumber}`;
}

// Helper to fetch QR code with retries
async function fetchQRCodeWithRetries(instanceName: string, maxRetries = 8): Promise<string | null> {
  // Initial wait to let Evolution API initialize the instance
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`Fetching QR code attempt ${attempt + 1} for ${instanceName}`);
    
    // Try the connect endpoint
    const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY!,
      },
    });
    
    const connectData = await connectResponse.json();
    console.log(`Connect response attempt ${attempt + 1}:`, JSON.stringify(connectData));
    
    // Check all possible paths for base64 QR code
    const base64 = connectData.base64 || 
                   connectData.qrcode?.base64 || 
                   connectData.code;
    
    if (base64 && typeof base64 === 'string' && base64.length > 100) {
      console.log('Found QR code base64!');
      return base64;
    }
    
    // Wait and retry - increasing delay
    console.log('QR not ready yet, waiting...');
    await new Promise(resolve => setTimeout(resolve, 2000 + (attempt * 1000)));
  }
  
  return null;
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

    // Check if this agent already has an instance
    const { data: existingInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('agent_id', agentId)
      .maybeSingle();

    // Use existing instance name or generate a new sequential one
    let instanceName: string;
    if (existingInstance?.instance_name) {
      instanceName = existingInstance.instance_name;
      console.log(`Using existing instance name: ${instanceName}`);
    } else {
      instanceName = await generateSequentialInstanceName(supabase);
      console.log(`Generated new sequential instance name: ${instanceName}`);
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
  
  // First check if instance exists and delete it
  try {
    const checkResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY!,
      },
    });
    const checkData = await checkResponse.json();
    
    if (Array.isArray(checkData) && checkData.length > 0) {
      console.log('Instance exists, deleting first...');
      await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY!,
        },
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {
    console.log('Check/delete failed, continuing:', e);
  }
  
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
  
  try {
    const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: [
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "MESSAGES_UPSERT"
          ]
        }
      }),
    });

    const webhookData = await webhookResponse.json();
    console.log('Evolution API webhook response:', JSON.stringify(webhookData));
  } catch (e) {
    console.error('Failed to configure webhook:', e);
  }

  // Try to get QR code
  let qrBase64 = data.qrcode?.base64 || null;
  
  if (!qrBase64) {
    console.log('No QR in create response, fetching with retries...');
    qrBase64 = await fetchQRCodeWithRetries(instanceName, 2);
  }

  // Save to database
  const { error: dbError } = await supabase
    .from('whatsapp_instances')
    .upsert({
      agent_id: agent.id,
      instance_name: instanceName,
      status: qrBase64 ? 'qr_pending' : 'connecting',
      evolution_instance_id: data.instance?.instanceName || instanceName,
      qr_code: qrBase64,
      qr_code_expires_at: qrBase64 ? new Date(Date.now() + 45000).toISOString() : null,
    }, {
      onConflict: 'agent_id'
    });

  if (dbError) {
    console.error('Database error:', dbError);
    throw new Error('Failed to save instance');
  }

  return { 
    success: true, 
    qrcode: qrBase64,
    instanceName: instanceName,
    message: qrBase64 ? null : 'Instância criada. Clique em "Gerar QR Code" para obter o código.'
  };
}

async function getQRCode(supabase: any, agentId: string, instanceName: string) {
  console.log(`Getting QR code for instance: ${instanceName}`);
  
  // First, check instance status
  const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': EVOLUTION_API_KEY!,
    },
  });
  
  const statusData = await statusResponse.json();
  console.log('Instance status:', JSON.stringify(statusData));
  
  let instanceExists = Array.isArray(statusData) && statusData.length > 0;
  let instanceStatus = instanceExists ? statusData[0].connectionStatus : null;
  
  console.log(`Instance exists: ${instanceExists}, connectionStatus: ${instanceStatus}`);
  
  // If instance doesn't exist or is closed, create a fresh one
  if (!instanceExists || instanceStatus === 'close') {
    console.log('Creating fresh instance for QR code...');
    
    // Delete if exists
    if (instanceExists) {
      await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY!,
        },
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Create new instance
    const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
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
    
    const createData = await createResponse.json();
    console.log('Fresh create response:', JSON.stringify(createData));
    
    if (!createResponse.ok) {
      throw new Error('Failed to create instance');
    }
  }
  
  // Now fetch QR code with retries
  const qrBase64 = await fetchQRCodeWithRetries(instanceName, 3);
  
  if (qrBase64) {
    // Update database with QR code
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
    };
  }

  // If all attempts failed, update status
  await supabase
    .from('whatsapp_instances')
    .update({
      status: 'connecting',
    })
    .eq('agent_id', agentId);

  return { 
    success: false, 
    qrcode: null,
    error: 'Não foi possível gerar o QR Code. Verifique se a Evolution API está funcionando corretamente.'
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
