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

async function disconnectWhatsAppInstance(instanceName: string): Promise<boolean> {
  try {
    console.log(`Disconnecting WhatsApp instance: ${instanceName}`);
    
    const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': EVOLUTION_API_KEY!,
      },
    });

    const data = await response.json();
    console.log(`Logout response for ${instanceName}:`, JSON.stringify(data));
    
    return response.ok;
  } catch (error) {
    console.error(`Error disconnecting instance ${instanceName}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date();

    // Find all users with expired plans (both trial and paid)
    const { data: expiredProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, plano, created_at, plan_expires_at');

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    const expiredUsers: string[] = [];

    for (const profile of expiredProfiles || []) {
      let isExpired = false;

      // Check trial plan expiration (3 days from creation)
      if (profile.plano === 'Plano Teste Grátis') {
        const createdAt = new Date(profile.created_at);
        const diffInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (diffInDays > 3) {
          isExpired = true;
        }
      } 
      // Check paid plan expiration
      else if (profile.plan_expires_at) {
        const expiresAt = new Date(profile.plan_expires_at);
        if (now > expiresAt) {
          isExpired = true;
        }
      }

      if (isExpired) {
        expiredUsers.push(profile.id);
        console.log(`User ${profile.email} has expired plan: ${profile.plano}`);
      }
    }

    if (expiredUsers.length === 0) {
      console.log('No expired plans found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No expired plans found',
        disconnectedCount: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all agents for expired users
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id')
      .in('user_id', expiredUsers);

    if (agentsError) {
      throw new Error(`Error fetching agents: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      console.log('No agents found for expired users');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No agents to disconnect',
        disconnectedCount: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentIds = agents.map(a => a.id);

    // Get all connected WhatsApp instances for these agents
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, agent_id, status')
      .in('agent_id', agentIds)
      .eq('status', 'connected');

    if (instancesError) {
      throw new Error(`Error fetching instances: ${instancesError.message}`);
    }

    let disconnectedCount = 0;

    for (const instance of instances || []) {
      console.log(`Processing instance: ${instance.instance_name}`);
      
      // Disconnect from Evolution API
      const disconnected = await disconnectWhatsAppInstance(instance.instance_name);
      
      // Update database status
      const { error: updateError } = await supabase
        .from('whatsapp_instances')
        .update({ 
          status: 'disconnected',
          qr_code: null,
          qr_code_expires_at: null,
          phone_number: null,
        })
        .eq('id', instance.id);

      if (updateError) {
        console.error(`Error updating instance ${instance.instance_name}:`, updateError);
      } else {
        disconnectedCount++;
        console.log(`Successfully disconnected and updated: ${instance.instance_name}`);
      }
    }

    console.log(`Total disconnected instances: ${disconnectedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Disconnected ${disconnectedCount} WhatsApp instances`,
      disconnectedCount,
      expiredUsersCount: expiredUsers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
