import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // read body just to match signature
  let body: { player_id?: number } = {};
  try { body = await req.json(); } catch {}
  if (!Number.isFinite(Number(body.player_id))) {
    return new Response(JSON.stringify({ error: "player_id must be a number" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // TODO: implement real logic; for now return "alreadyClaimed" = false and no cards
  return new Response(JSON.stringify({
    ok: true,
    alreadyClaimed: true,
    cards: [],
    dustAwarded: 0
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
});
