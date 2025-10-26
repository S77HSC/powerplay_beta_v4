// Supabase Edge Function: award-weekly
// Computes weekly trophies from v_weekly_training and writes to public.trophy_awards.
// Awards:
// - player_week  : top effort_score (tie-break: points, minutes)
// - iron_week    : top minutes excluding Player of the Week (tie-break: effort_score, points)
// - improved_week: biggest positive delta vs *last* week (excludes PoW & Grafter)
// - pb_week      : beaten personal best prior to this week. Optional: count first-ever week as PB.
//
// ENV (set via `supabase secrets set`):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - AWARDS_INCLUDE_FIRST_PB = "true" | "false"  (default: "true")
//
// Optional request body (JSON):
// {
//   week_start?: string;               // e.g. "2025-10-20". If omitted, uses the latest week in v_weekly_training.
//   includeFirstPb?: boolean;          // override env toggle for this invocation
// }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface WeeklyRow {
  player_id: number | null;
  week_start: string; // YYYY-MM-DD
  minutes: number | null;
  points: number | null;
  effort_score: number | null;
  effort_tier?: string | null;
}

interface AwardRowInsert {
  trophy_code: string;
  period_start: string; // YYYY-MM-DD
  player_id: number;
  metrics: Record<string, unknown>;
}

function asDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prevWeekOf(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return asDateString(d);
}

function pickTop<T>(items: T[], cmp: (a: T, b: T) => number): T | undefined {
  if (items.length === 0) return undefined;
  return items.slice().sort(cmp)[0];
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Parse body (POST/GET both supported for convenience)
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore if no JSON */ }

    // Toggle: include first-ever PBs?
    const envFirst = (Deno.env.get("AWARDS_INCLUDE_FIRST_PB") ?? "true").toLowerCase() === "true";
    const includeFirstPb: boolean = typeof body?.includeFirstPb === "boolean" ? body.includeFirstPb : envFirst;

    // Determine target week
    let targetWeek: string | null = typeof body?.week_start === "string" && body.week_start
      ? body.week_start
      : null;

    if (!targetWeek) {
      const { data: latest, error: latestErr } = await supabase
        .from("v_weekly_training")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1);
      if (latestErr) throw latestErr;
      if (!latest || latest.length === 0) {
        return new Response(JSON.stringify({ inserted: [], reason: "no_weeks_found" }), { headers: { "Content-Type": "application/json" } });
      }
      targetWeek = (latest[0] as any).week_start as string;
    }

    const lastWeek = prevWeekOf(targetWeek);

    // Fetch this week
    const { data: weekRowsRaw, error: wkErr } = await supabase
      .from("v_weekly_training")
      .select("player_id, week_start, minutes, points, effort_score, effort_tier")
      .eq("week_start", targetWeek)
      .order("effort_score", { ascending: false });
    if (wkErr) throw wkErr;

    const weekRows: WeeklyRow[] = (weekRowsRaw || []).filter(r =>
      r.player_id !== null && (r.minutes ?? 0) > 0 && (r.effort_score ?? 0) >= 0,
    ) as any;

    // Early exit if no players
    if (weekRows.length === 0) {
      return new Response(JSON.stringify({ inserted: [], week_start: targetWeek, reason: "no_players_this_week" }), { headers: { "Content-Type": "application/json" } });
    }

    // Build player set for queries
    const playerIds = Array.from(new Set(weekRows.map(r => r.player_id!)));

    // Fetch last week for Most Improved
    const { data: lastRowsRaw, error: lastErr } = await supabase
      .from("v_weekly_training")
      .select("player_id, week_start, effort_score")
      .eq("week_start", lastWeek)
      .in("player_id", playerIds);
    if (lastErr) throw lastErr;
    const lastMap = new Map<number, number>();
    (lastRowsRaw || []).forEach((r: any) => { if (r.player_id && r.effort_score != null) lastMap.set(r.player_id, r.effort_score); });

    // Fetch all prior weeks for PB calc
    const { data: priorRowsRaw, error: priorErr } = await supabase
      .from("v_weekly_training")
      .select("player_id, week_start, effort_score")
      .lt("week_start", targetWeek)
      .in("player_id", playerIds);
    if (priorErr) throw priorErr;
    const pbBefore = new Map<number, number>();
    (priorRowsRaw || []).forEach((r: any) => {
      if (r.player_id && r.effort_score != null) {
        const prev = pbBefore.get(r.player_id) ?? 0;
        pbBefore.set(r.player_id, Math.max(prev, r.effort_score));
      }
    });

    // 1) Player of the Week (top effort_score, then points, then minutes)
    const playerOfWeek = pickTop(weekRows, (a, b) => {
      const cmpScore = (b.effort_score ?? 0) - (a.effort_score ?? 0);
      if (cmpScore !== 0) return cmpScore;
      const cmpPts = (b.points ?? 0) - (a.points ?? 0);
      if (cmpPts !== 0) return cmpPts;
      return (b.minutes ?? 0) - (a.minutes ?? 0);
    });

    // 2) Grafter (top minutes excluding PoW)
    const grafterPool = weekRows.filter(r => r.player_id !== playerOfWeek?.player_id);
    const grafter = pickTop(grafterPool, (a, b) => {
      const cmpMin = (b.minutes ?? 0) - (a.minutes ?? 0);
      if (cmpMin !== 0) return cmpMin;
      const cmpScore = (b.effort_score ?? 0) - (a.effort_score ?? 0);
      if (cmpScore !== 0) return cmpScore;
      return (b.points ?? 0) - (a.points ?? 0);
    });

    // 3) Most Improved vs last week (exclude PoW & Grafter)
    const improvedCandidates = weekRows
      .filter(r => r.player_id !== playerOfWeek?.player_id && r.player_id !== grafter?.player_id)
      .map(r => ({
        row: r,
        prev: lastMap.get(r.player_id!),
      }))
      .filter(x => typeof x.prev === "number" && (x.row.effort_score ?? 0) > (x.prev as number));

    improvedCandidates.sort((a, b) => {
      const aDelta = (a.row.effort_score ?? 0) - (a.prev as number);
      const bDelta = (b.row.effort_score ?? 0) - (b.prev as number);
      if (bDelta !== aDelta) return bDelta - aDelta;
      return (b.row.effort_score ?? 0) - (a.row.effort_score ?? 0);
    });
    const improved = improvedCandidates[0];

    // 4) PB beaten
    const pbWinners: { row: WeeklyRow; pb_before: number; first_pb?: boolean }[] = [];
    for (const r of weekRows) {
      const before = pbBefore.get(r.player_id!) ?? 0;
      const score = r.effort_score ?? 0;
      if (before > 0 && score > before) {
        pbWinners.push({ row: r, pb_before: before });
      } else if (includeFirstPb && before === 0 && score > 0) {
        pbWinners.push({ row: r, pb_before: 0, first_pb: true });
      }
    }

    // Compose inserts (idempotent via upsert on unique index)
    const inserts: AwardRowInsert[] = [];

    if (playerOfWeek) {
      inserts.push({
        trophy_code: "player_week",
        period_start: targetWeek,
        player_id: playerOfWeek.player_id!,
        metrics: {
          effort_score: playerOfWeek.effort_score ?? 0,
          points: playerOfWeek.points ?? 0,
          minutes: playerOfWeek.minutes ?? 0,
          effort_tier: playerOfWeek.effort_tier ?? null,
        },
      });
    }

    if (grafter) {
      inserts.push({
        trophy_code: "iron_week",
        period_start: targetWeek,
        player_id: grafter.player_id!,
        metrics: {
          minutes: grafter.minutes ?? 0,
          effort_score: grafter.effort_score ?? 0,
          points: grafter.points ?? 0,
        },
      });
    }

    if (improved) {
      const delta = (improved.row.effort_score ?? 0) - (improved.prev as number);
      inserts.push({
        trophy_code: "improved_week",
        period_start: targetWeek,
        player_id: improved.row.player_id!,
        metrics: {
          effort_delta: delta,
          effort_prev: improved.prev,
          effort_score: improved.row.effort_score ?? 0,
        },
      });
    }

    for (const p of pbWinners) {
      inserts.push({
        trophy_code: "pb_week",
        period_start: targetWeek,
        player_id: p.row.player_id!,
        metrics: {
          effort_pb_before: p.pb_before,
          effort_score: p.row.effort_score ?? 0,
          ...(p.first_pb ? { first_pb: true } : {}),
          ...(p.pb_before > 0
            ? { pb_pct_gain: Math.round(10 * (100 * ((p.row.effort_score ?? 0) - p.pb_before) / p.pb_before)) / 10 }
            : {}),
        },
      });
    }

    // If nothing to write, return gracefully
    if (inserts.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, week_start: targetWeek, note: "no_eligible_awards" }), { headers: { "Content-Type": "application/json" } });
    }

    // Upsert (requires unique index on (player_id, period_start, trophy_code))
    const { data: upserted, error: upsertErr } = await supabase
      .from("trophy_awards")
      .upsert(inserts, { onConflict: "player_id,period_start,trophy_code" })
      .select();
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ week_start: targetWeek, inserted: upserted?.length ?? 0, includeFirstPb, winners: upserted }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

/*
Local dev
---------
1) Start services
   supabase start

2) Serve this function locally
   supabase functions serve award-weekly --no-verify-jwt

3) Set secrets (service role!)
   supabase secrets set SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-service-role
   # optional
   supabase secrets set AWARDS_INCLUDE_FIRST_PB=true

4) Hit the function
   curl -sS -X POST "http://127.0.0.1:54321/functions/v1/award-weekly" \
     -H "Content-Type: application/json" \
     -d '{"includeFirstPb": true}' | jq

Deploy + schedule
-----------------
# Deploy
supabase functions deploy award-weekly

# Optional scheduled run every Monday 05:05 Europe/London (edge scheduler uses UTC)
# 05:05 London ≈ 04:05 UTC in winter. Adjust for DST as needed.
# You can safely omit the body; it will pick the latest week in the view.
# From the dashboard: Functions → award-weekly → Schedule → CRON: "5 4 * * 1"
*/
