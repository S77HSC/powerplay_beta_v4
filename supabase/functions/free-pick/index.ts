// supabase/functions/free-pick/index.ts
// Grants a new card if available; otherwise returns 200 with a graceful message.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function okJSON(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
function errJSON(message: string, status = 400) {
  return okJSON({ ok: false, error: message }, status);
}

Deno.serve(async (req: Request) => {
  // Preflight must not crash
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: cors });
  if (req.method !== "POST") return errJSON("Method not allowed", 405);

  try {
    const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")      ?? Deno.env.get("SB_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return errJSON("Missing function secrets", 500);

    // Import AFTER OPTIONS so CORS preflight can’t 500
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2?target=deno");
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Auth user
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return errJSON("Unauthorized", 401);
    const authId = userData.user.id;

    // Body
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const player_id = typeof body.player_id === "number" ? body.player_id : null;
    if (!player_id) return errJSON("Missing or invalid 'player_id' (number required)", 400);

    // 1) Owned cards for this player
    const ownedRes = await client.from("user_cards").select("card_id").eq("player_id", player_id);
    if (ownedRes.error) return errJSON(`DB error (owned): ${ownedRes.error.message}`, 500);
    const owned = new Set((ownedRes.data ?? []).map((r: any) => r.card_id));

    // 2) All card ids
    const cardsRes = await client.from("cards").select("id").limit(5000);
    if (cardsRes.error) return errJSON(`DB error (cards): ${cardsRes.error.message}`, 500);
    const allIds: number[] = (cardsRes.data ?? []).map((c: any) => c.id);

    // 3) Filter available (not yet owned)
    const available = allIds.filter((id) => !owned.has(id));

    // 4) If none left → graceful 200 with message, no rewards
    if (available.length === 0) {
      return okJSON({
        ok: true,
        alreadyClaimed: true,
        cards: [],
        message: "No new cards right now — new rewards coming soon!",
      });
    }

    // 5) Choose & insert a new card
    const choice = available[Math.floor(Math.random() * available.length)];
    const nowIso = new Date().toISOString();

    const ins = await client
      .from("user_cards")
      .insert({ player_id, auth_id: authId, card_id: choice, obtained_at: nowIso, is_equipped: false })
      .select("card_id, obtained_at")
      .single();

    if (ins.error) {
      // If a rare race condition hits the unique (player_id, card_id), return the same graceful response
      if ((ins.error as any).code === "23505") {
        return okJSON({
          ok: true,
          alreadyClaimed: true,
          cards: [],
          message: "No new cards right now — new rewards coming soon!",
        });
      }
      return errJSON(`DB error (insert user_cards): ${ins.error.message}`, 500);
    }

    // Success: return one card for the UI to reveal
    return okJSON({
      ok: true,
      alreadyClaimed: false,
      cards: [{ card_id: ins.data.card_id }],
      message: null,
    });
  } catch (e) {
    return errJSON(String(e), 500);
  }
});
