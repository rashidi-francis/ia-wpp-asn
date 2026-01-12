import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

function getRateLimitKey(req: Request): string {
  // Use X-Forwarded-For header or fall back to a default
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return ip;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count++;
  return false;
}

// Cleanup old rate limit entries periodically
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cleanup old entries
    cleanupRateLimits();

    // Rate limiting check
    const rateLimitKey = getRateLimitKey(req);
    if (isRateLimited(rateLimitKey)) {
      console.warn("Rate limit exceeded for IP:", rateLimitKey);
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde um momento antes de tentar novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, systemPrompt, agentId } = await req.json();

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagens inválidas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== "string") {
        return new Response(
          JSON.stringify({ error: "Formato de mensagem inválido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Limit message content length to prevent abuse
      if (msg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: "Mensagem muito longa." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Limit number of messages to prevent context abuse
    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Número máximo de mensagens excedido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate agentId if provided - verify agent exists in database
    if (agentId) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
      
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data: agent, error: agentError } = await supabase
          .from("agents")
          .select("id")
          .eq("id", agentId)
          .maybeSingle();
        
        if (agentError || !agent) {
          console.warn("Invalid agentId provided:", agentId);
          return new Response(
            JSON.stringify({ error: "Agente não encontrado." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log("Widget chat request for agent:", agentId);
    console.log("System prompt length:", systemPrompt?.length);
    console.log("Messages count:", messages?.length);
    console.log("Rate limit key:", rateLimitKey);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: systemPrompt || "Você é um assistente prestativo. Responda de forma clara e concisa em português brasileiro." 
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";

    console.log("AI response received, length:", assistantMessage.length);

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Widget chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
