import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TZ = "Europe/London";

function cors(status = 200, body: unknown = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "POST, GET, OPTIONS",
    },
  });
}

function todayLondon() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).reduce((a: any, t) => ((a[t.type] = t.value), a), {});
  const s = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); s.setUTCHours(0, 0, 0, 0);
  return s.toISOString().slice(0, 10);
}

function getClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SERVICE_ROLE_KEY"); // set in function Secrets
  if (!url) throw new Error("Missing SUPABASE_URL env");
  if (!key) throw new Error("Missing SERVICE_ROLE_KEY env");
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return cors(204, {});
    if (req.method !== "POST") return cors(405, { ok: false, error: "Method not allowed" });

    const body = await req.json().catch(() => ({}));
    const rawUserId = body?.user_id as string | undefined;
    const rawPlayerId = body?.player_id as number | string | undefined;

    const sb = getClient();
    const period = todayLondon();

    // Resolve player_id from either input
    let player_id: number | null = null;
    if (rawPlayerId != null && Number.isFinite(Number(rawPlayerId))) {
      player_id = Number(rawPlayerId);
    } else if (typeof rawUserId === "string" && rawUserId.length > 20) {
      const { data: player } = await sb.from("players").select("id").eq("auth_id", rawUserId).maybeSingle();
      player_id = player?.id ?? null;
    }

    if (!player_id) {
      return cors(404, { ok: false, error: "player not found", received: { user_id: rawUserId ?? null, player_id: rawPlayerId ?? null } });
    }

    // Must be today’s Player of the Day
    const { data: win } = await sb
      .from("trophy_awards")
      .select("id")
      .eq("trophy_code", "player_day")
      .eq("period_start", period)
      .eq("player_id", player_id)
      .maybeSingle();

    if (!win?.id) return cors(200, { ok: false, reason: "not a Player of the Day winner" });

    // Already claimed?
    const { data: prior } = await sb
      .from("user_rewards")
      .select("id")
      .or(`user_id.eq.${rawUserId ?? ''},user_id.is.null`) // allow null user_id if you awarded without it
      .eq("type", "player_day")
      .eq("period_start", period)
      .maybeSingle();

    if (prior?.id) return cors(200, { ok: false, alreadyClaimed: true });

    // Pick one epic (fallback to any)
    let card: any = null;
    const { data: pool } = await sb.from("cards").select("id,name,rarity,image_url").eq("rarity", "epic").limit(100);
    if (pool && pool.length) card = pool[Math.floor(Math.random() * pool.length)];
    else card = (await sb.from("cards").select("id,name,rarity,image_url").limit(1).maybeSingle()).data;

    const grants = card ? [{ card_id: card.id, name: card.name, rarity: card.rarity, image_url: card.image_url ?? null }] : [];
    const dustAwarded = 20;

    // Upsert user_cards
    if (grants.length) {
      await sb.from("user_cards").upsert(
        grants.map(g => ({ player_id, card_id: g.card_id, is_equipped: false })),
        { onConflict: "player_id,card_id" },
      );
    }

    // Ledger (use user_id only if provided)
    await sb.from("user_rewards").insert({
      user_id: typeof rawUserId === "string" ? rawUserId : null,
      type: "player_day",
      period_start: period,
      payload: { cards: grants, dustAwarded },
    });

    return cors(200, { ok: true, cards: grants, dustAwarded });
  } catch (e) {
    return cors(500, { ok: false, error: String((e as any)?.message || e) });
  }
});
