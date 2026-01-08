import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Scopes needed for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // Route: /google-calendar-oauth/auth - Start OAuth flow
    if (path === 'auth' || req.method === 'POST') {
      return await handleAuthStart(req);
    }
    
    // Route: /google-calendar-oauth/callback - Handle OAuth callback
    if (path === 'callback') {
      return await handleCallback(req, url);
    }

    // Route: /google-calendar-oauth/status - Check connection status
    if (path === 'status') {
      return await handleStatus(req);
    }

    // Route: /google-calendar-oauth/disconnect - Disconnect calendar
    if (path === 'disconnect') {
      return await handleDisconnect(req);
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in google-calendar-oauth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleAuthStart(req: Request) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  // Get user from auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { agentId, redirectOrigin } = await req.json();
  
  if (!agentId) {
    return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify user owns the agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (agentError || !agent) {
    return new Response(JSON.stringify({ error: 'Agent not found or access denied' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Store state in database for callback verification
  const { data: stateData, error: stateError } = await supabase
    .from('agent_calendar_oauth_states')
    .insert({
      user_id: user.id,
      agent_id: agentId,
      redirect_origin: redirectOrigin || 'https://chatasn.lovable.app',
    })
    .select('id')
    .single();

  if (stateError) {
    console.error('Error creating state:', stateError);
    return new Response(JSON.stringify({ error: 'Failed to create OAuth state' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const state = stateData.id;
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-oauth/callback`;

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log('Generated OAuth URL for agent:', agentId);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCallback(req: Request, url: URL) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return createRedirectResponse('Erro na autenticação: ' + error, false);
  }

  if (!code || !state) {
    return createRedirectResponse('Parâmetros inválidos', false);
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Verify state and get agent info
  const { data: stateData, error: stateError } = await supabase
    .from('agent_calendar_oauth_states')
    .select('*')
    .eq('id', state)
    .maybeSingle();

  if (stateError || !stateData) {
    console.error('Invalid state:', stateError);
    return createRedirectResponse('Estado inválido ou expirado', false);
  }

  // Delete the state (one-time use)
  await supabase.from('agent_calendar_oauth_states').delete().eq('id', state);

  // Check if state is expired (5 minutes)
  const createdAt = new Date(stateData.created_at);
  const now = new Date();
  if (now.getTime() - createdAt.getTime() > 5 * 60 * 1000) {
    return createRedirectResponse('Estado expirado', false, stateData.redirect_origin);
  }

  // Exchange code for tokens
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-oauth/callback`;
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    console.error('Token exchange failed:', tokenData);
    return createRedirectResponse('Falha ao obter tokens', false, stateData.redirect_origin);
  }

  console.log('Successfully obtained tokens for agent:', stateData.agent_id);

  // Get user's email from Google
  let userEmail = null;
  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    userEmail = userInfo.email;
    console.log('Got user email:', userEmail);
  } catch (e) {
    console.error('Failed to get user email:', e);
  }

  // Save refresh token and enable calendar
  const { error: updateError } = await supabase
    .from('agent_calendar_settings')
    .upsert({
      agent_id: stateData.agent_id,
      enabled: true,
      google_refresh_token: tokenData.refresh_token,
      google_calendar_id: userEmail || 'primary',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'agent_id'
    });

  if (updateError) {
    console.error('Failed to save tokens:', updateError);
    return createRedirectResponse('Falha ao salvar configurações', false, stateData.redirect_origin);
  }

  return createRedirectResponse('Agenda conectada com sucesso!', true, stateData.redirect_origin);
}

function createRedirectResponse(message: string, success: boolean, origin?: string) {
  const baseUrl = origin || 'https://chatasn.lovable.app';
  const redirectUrl = `${baseUrl}/dashboard?calendar_connected=${success}&message=${encodeURIComponent(message)}`;
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
    },
  });
}

async function handleStatus(req: Request) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');

  if (!agentId) {
    return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify user owns the agent and get calendar settings
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: settings } = await supabase
    .from('agent_calendar_settings')
    .select('enabled, google_refresh_token, google_calendar_id')
    .eq('agent_id', agentId)
    .maybeSingle();

  const isConnected = !!(settings?.google_refresh_token);
  
  return new Response(JSON.stringify({
    connected: isConnected,
    enabled: settings?.enabled || false,
    calendarEmail: isConnected ? settings?.google_calendar_id : null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDisconnect(req: Request) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { agentId } = await req.json();

  if (!agentId) {
    return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify user owns the agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Clear the refresh token and disable
  const { error: updateError } = await supabase
    .from('agent_calendar_settings')
    .update({
      enabled: false,
      google_refresh_token: null,
      google_calendar_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', agentId);

  if (updateError) {
    console.error('Failed to disconnect:', updateError);
    return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
