// supabase/functions/equip-card/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeCorsHeaders } from "../_shared/cors.ts";

type Body = { player_id?: number; user_card_id?: number };

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || undefined;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: makeCorsHeaders(origin) });
  }

  try {
    const { player_id, user_card_id }: Body = await req.json().catch(() => ({} as Body));
    if (!Number.isFinite(player_id) || !Number.isFinite(user_card_id)) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { "content-type": "application/json", ...makeCorsHeaders(origin) },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // 1) Un-equip everything for this player
    const off = await admin
      .from("user_cards")
      .update({ is_equipped: false })
      .eq("player_id", player_id);

    if (off.error) throw off.error;

    // 2) Equip the chosen card (and make sure it belongs to the player)
    const on = await admin
      .from("user_cards")
      .update({ is_equipped: true })
      .eq("id", user_card_id)
      .eq("player_id", player_id)
      .select("id")
      .maybeSingle();

    if (on.error) throw on.error;
    if (!on.data) {
      return new Response(JSON.stringify({ error: "not_found_or_forbidden" }), {
        status: 404,
        headers: { "content-type": "application/json", ...makeCorsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", ...makeCorsHeaders(origin) },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", detail: String(e?.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json", ...makeCorsHeaders(origin) },
    });
  }
});
