// supabase/functions/free-pick/index.ts
// Edge Function: awards a free card if not on cooldown

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Method Not Allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function env." },
        500
      );
    }

    // Service-role client (bypasses RLS; keep this server-side only)
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Accept both player_id (preferred) and legacy player_id
    const body = await req.json().catch(() => ({}));
    const rawId = body?.player_id ?? body?.player_id;
    const player_id = Number(rawId);

    if (!Number.isFinite(player_id)) {
      return json({ ok: false, error: "Bad or missing player_id" }, 400);
    }

    // 1) Cooldown check
    const { data: prog, error: progErr } = await db
      .from("user_progress")
      .select("next_free_pick_at")
      .eq("player_id", player_id)
      .maybeSingle();

    if (progErr) throw progErr;

    const now = new Date();
    const nextAt = prog?.next_free_pick_at ? new Date(prog.next_free_pick_at) : null;
    if (nextAt && nextAt > now) {
      // Not an error — just not ready yet
      return json({ ok: false, reason: "cooldown", nextFreePickAt: nextAt.toISOString() }, 200);
    }

    // 2) Pick a card to award
    const { data: allCards, error: cardsErr } = await db
      .from("cards")
      .select("id, rarity, weight, is_active")
      .eq("is_active", true)
      .limit(5000);

    if (cardsErr) throw cardsErr;
    if (!allCards?.length) return json({ ok: false, error: "No active cards available" }, 200);

    const cardId = chooseCardId(allCards);

    // 3) Insert into user_cards
    // NOTE: This assumes user_cards has a player_id column.
    // If your user_cards table uses player_id instead, change 'player_id' below to 'player_id'.
    const { data: uc, error: insErr } = await db
      .from("user_cards")
      .insert({
        player_id: player_id,
        card_id: cardId,
        is_equipped: false,
        obtained_at: now.toISOString(),
      })
      .select("id, card_id, is_equipped")
      .single();

    if (insErr) throw insErr;

    // 4) Set the next cooldown (24h example)
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { error: upErr } = await db
      .from("user_progress")
      .upsert(
        { player_id, next_free_pick_at: next.toISOString() },
        { onConflict: "player_id" }
      );

    if (upErr) throw upErr;

    // 5) Done
    return json(
      {
        ok: true,
        card: { user_card_id: uc.id, card_id: uc.card_id },
        nextFreePickAt: next.toISOString(),
      },
      200
    );
  } catch (e) {
    console.error("free-pick error:", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type CardRow = {
  id: number;
  rarity?: string | null;
  weight?: number | null;
  is_active?: boolean | null;
};

// Weighted choice: uses `weight` if present; otherwise biases by rarity.
function chooseCardId(rows: CardRow[]): number {
  const weights = rows.map((r) => {
    if (typeof r.weight === "number" && r.weight > 0) return r.weight;
    const rar = (r.rarity || "").toLowerCase();
    if (rar === "legendary") return 1;   // rare
    if (rar === "epic") return 3;
    if (rar === "rare") return 10;
    return 30;                           // common
  });

  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let pick = Math.random() * total;
  for (let i = 0; i < rows.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return rows[i].id;
  }
  return rows[rows.length - 1].id;
}