import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fingerprint, action, userId } = await req.json();

    if (!fingerprint) {
      return new Response(
        JSON.stringify({ error: "Fingerprint is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "check") {
      // Check if fingerprint can create a new account
      const { data, error } = await supabase.rpc("can_create_account_with_fingerprint", {
        p_fingerprint: fingerprint,
      });

      if (error) {
        console.error("Error checking fingerprint:", error);
        return new Response(
          JSON.stringify({ error: "Failed to check fingerprint" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register" && userId) {
      // Register fingerprint for a new user
      const { error } = await supabase
        .from("device_fingerprints")
        .insert({
          fingerprint,
          user_id: userId,
        });

      if (error) {
        console.error("Error registering fingerprint:", error);
        return new Response(
          JSON.stringify({ error: "Failed to register fingerprint" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
