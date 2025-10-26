// supabase/functions/award-weekly/index.ts
// Schedules weekly trophies (Mon→Sun, Europe/London).
// Run with Service Role. No request body needed.
// Response: JSON summary of awards.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(url, service, { auth: { persistSession: false } });

const TZ = "Europe/London";

function res(status: number, body: unknown) {
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
function londonWallclock(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {} as Record<string,string>);
  return new Date(Date.UTC(+parts.year, +parts.month-1, +parts.day, +parts.hour, +parts.minute, +parts.second));
}
function weekStart(d = new Date()) {
  const z = londonWallclock(d);
  const dow = (z.getUTCDay() + 6) % 7; // Mon=0
  const s = new Date(z); s.setUTCDate(s.getUTCDate()-dow); s.setUTCHours(0,0,0,0); return s;
}
function weekEnd(d = new Date()) { const s = weekStart(d); const e = new Date(s); e.setUTCDate(e.getUTCDate()+7); e.setUTCMilliseconds(-1); return e; }
function prevWeekStart(d = new Date()) { const s = weekStart(d); const p = new Date(s); p.setUTCDate(p.getUTCDate()-7); return p; }
function prevWeekEnd(d = new Date()) { const s = weekStart(d); const p = new Date(s); p.setUTCMilliseconds(-1); return p; }
const ymd = (d: Date) => d.toISOString().slice(0,10);
const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type Agg = { player_id: number; xr: number; sessions: number; work_time: number; touches: number };

async function fetchWindowAgg(start: Date, end: Date): Promise<Agg[]> {
  // Prefer completed_at, then fallback created_at (for older rows)
  const base = new Map<number, Agg>();
  const q1 = await sb
    .from("workout_sessions")
    .select("player_id,xr_awarded,work_time,touches")
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString());
  const rows1 = q1.data ?? [];
  const q2 = await sb
    .from("workout_sessions")
    .select("player_id,xr_awarded,work_time,touches")
    .is("completed_at", null)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  const rows2 = q2.data ?? [];

  for (const r of [...rows1, ...rows2]) {
    const pid = Number(r.player_id);
    if (!Number.isFinite(pid)) continue;
    const cur = base.get(pid) ?? { player_id: pid, xr: 0, sessions: 0, work_time: 0, touches: 0 };
    cur.xr += toNum(r.xr_awarded);
    cur.sessions += 1;
    cur.work_time += toNum(r.work_time);
    cur.touches += toNum(r.touches);
    base.set(pid, cur);
  }
  return [...base.values()];
}

function topBy<T>(arr: T[], key: (x: T)=>number, filter?: (x:T)=>boolean): T[] {
  const list = filter ? arr.filter(filter) : arr.slice();
  if (!list.length) return [];
  list.sort((a,b)=>key(b)-key(a));
  const best = key(list[0]);
  return list.filter(x => key(x) === best);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return res(204,{});
  try {
    const now = new Date(); // server time; converted to London below
    const ws = weekStart(now), we = weekEnd(now);
    const pws = prevWeekStart(now), pwe = prevWeekEnd(now);
    const period = ymd(ws);

    // 1) Aggregate this week + last week
    const [cur, prev] = await Promise.all([fetchWindowAgg(ws, we), fetchWindowAgg(pws, pwe)]);
    const prevMap = new Map(prev.map(p => [p.player_id, p]));

    // 2) Compute winners
    // thresholds (tune as you like)
    const MIN_SESS_POW = 3;     // Player of Week needs >=3 sessions
    const MIN_XR_GRINDER = 200; // Grinder: only if XR >= 200
    const MIN_PREV_FOR_IMPROVE = 100;
    const MIN_THIS_FOR_IMPROVE = 200;

    const potw = topBy(cur, x => x.xr, x => x.sessions >= MIN_SESS_POW);
    const grinder = topBy(cur.filter(x => x.xr >= MIN_XR_GRINDER), x => x.sessions);
    const iron = topBy(cur, x => x.work_time);

    // Most Improved (% XR vs previous week)
    const improvedCandidates = cur
      .map(x => {
        const prevXR = prevMap.get(x.player_id)?.xr ?? 0;
        return { ...x, prevXR, pct: prevXR > 0 ? (x.xr - prevXR)/prevXR : 0 };
      })
      .filter(x => x.prevXR >= MIN_PREV_FOR_IMPROVE && x.xr >= MIN_THIS_FOR_IMPROVE);
    const improved = topBy(improvedCandidates, x => x.pct);

    // Personal Best (beat best_weekly_xr)
    const ids = cur.map(x => x.player_id);
    const { data: bestRows } = await sb.from("player_bests").select("player_id,best_weekly_xr").in("player_id", ids);
    const bestMap = new Map((bestRows ?? []).map(b => [b.player_id, Number(b.best_weekly_xr) || 0]));
    const personalBest = cur.filter(x => x.xr > (bestMap.get(x.player_id) ?? 0));

    // 3) Upsert awards & update personal bests
    const awards: Array<{code:string, player_id:number, metrics:Record<string,unknown>}> = [];
    for (const w of potw) awards.push({ code:"player_week", player_id:w.player_id, metrics:{ xr:w.xr, sessions:w.sessions, work_time:w.work_time }});
    for (const w of grinder) awards.push({ code:"grinder_week", player_id:w.player_id, metrics:{ xr:w.xr, sessions:w.sessions }});
    for (const w of iron) awards.push({ code:"iron_week", player_id:w.player_id, metrics:{ work_time:w.work_time, xr:w.xr, sessions:w.sessions }});
    for (const w of improved) awards.push({ code:"improved_week", player_id:w.player_id, metrics:{ pct: w.pct, xr:w.xr, prev_xr:w.prevXR }});
    for (const w of personalBest) awards.push({ code:"pb_week", player_id:w.player_id, metrics:{ xr:w.xr }});

    // Resolve user_id for each player (for convenience in UI)
    const { data: playersRows } = await sb.from("players").select("id,auth_id").in("id", [...new Set(awards.map(a=>a.player_id))]);
    const userMap = new Map((playersRows ?? []).map(p => [p.id, p.auth_id]));

    // Upsert awards (ignore duplicates for same period)
    const payload = awards.map(a => ({
      trophy_code: a.code,
      period_start: period,
      player_id: a.player_id,
      user_id: userMap.get(a.player_id) ?? null,
      metrics: a.metrics as any
    }));
    if (payload.length) {
      // insert ... on conflict do nothing handled by unique constraint
      await sb.from("trophy_awards").insert(payload);
    }

    // Update personal bests
    for (const w of personalBest) {
      const best = bestMap.get(w.player_id) ?? 0;
      if (w.xr > best) {
        await sb.from("player_bests")
          .upsert({ player_id: w.player_id, best_weekly_xr: w.xr, best_week_start: period });
      }
    }

    return res(200, {
      ok: true,
      period,
      counts: {
        potw: potw.length, grinder: grinder.length, iron: iron.length,
        improved: improved.length, personalBest: personalBest.length,
      },
    });
  } catch (e) {
    return res(500, { ok:false, error: String(e?.message || e) });
  }
});
