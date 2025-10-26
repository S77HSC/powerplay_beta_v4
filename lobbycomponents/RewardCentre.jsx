"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Map award codes -> labels + icons (put PNGs in /public/trophies)
const TROPHY_META = {
  player_week: { title: "Player of the Week", icon: "/trophies/player_week.png" },
  iron_week: { title: "Grafter of the Week", icon: "/trophies/grafter.png" },
  improved_week: { title: "Most Improved", icon: "/trophies/most_improved.png" },
  pb_week: { title: "Personal Best", icon: "/trophies/high_score.png" },
};

// display order for the reward prompt
const ORDER = ["weekly", "streak", "free"];

function fmt(ms) {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function RewardCentre({ player_id, user_id, playerId }) {
  // accept any prop name used in the app
  const pid = Number(player_id ?? user_id ?? playerId);
  const canUse = useMemo(() => Number.isFinite(pid) && pid > 0, [pid]);

  // prompt state (weekly / streak / free)
  const [queue, setQueue] = useState([]); // e.g. ["weekly","free"]
  const [promptOpen, setPromptOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // free pick countdown
  const [nextFreePickAt, setNextFreePickAt] = useState(null);
  const countdown = useRef("…");

  // awards overlay (auto once/week)
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [latestWeek, setLatestWeek] = useState(null);
  const [latestAwards, setLatestAwards] = useState([]);

  // ---------------- Eligibility & progress ----------------
  const check = useCallback(async () => {
    if (!canUse) return;

    // 1) weekly + streak via RPC
    let elig = null;
    try {
      const { data, error } = await supabase.rpc("fn_reward_eligibility_v4", { p_player: pid });
      if (error) throw error;
      elig = Array.isArray(data) ? data?.[0] : data;
    } catch {
      // ignore; fall back to no weekly/streak
    }

    const wants = [];
    if (elig?.effort_tier && elig.effort_tier !== "none") wants.push("weekly");
    if ((elig?.streak_days || 0) >= 3) wants.push("streak");

    // 2) free pick readiness
    try {
      const { data: prog } = await supabase
        .from("user_progress")
        .select("next_free_pick_at")
        .eq("player_id", pid)
        .maybeSingle();

      setNextFreePickAt(prog?.next_free_pick_at || null);
      const freeReady = !prog?.next_free_pick_at || new Date(prog.next_free_pick_at) <= new Date();
      if (freeReady) wants.push("free");
    } catch {
      // ignore free pick if query fails
    }

    const ordered = ORDER.filter((k) => wants.includes(k));
    setQueue(ordered);
    setPromptOpen(ordered.length > 0);
  }, [canUse, pid]);

  useEffect(() => {
    check();
  }, [check]);

  // keep countdown ticking for free pick
  useEffect(() => {
    if (!nextFreePickAt) return;
    const t = setInterval(() => {
      countdown.current = fmt(new Date(nextFreePickAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [nextFreePickAt]);

  // ---------------- Awards overlay (latest week) ----------------
  useEffect(() => {
    if (!canUse) return;
    (async () => {
      const { data, error } = await supabase
        .from("trophy_awards")
        .select("trophy_code, period_start, player_id, metrics")
        .eq("player_id", pid)
        .order("period_start", { ascending: false })
        .limit(50);
      if (error || !data?.length) return;
      const newest = data[0].period_start;
      const thisWeek = data.filter((r) => r.period_start === newest);
      if (!thisWeek.length) return;
      setLatestWeek(newest);
      setLatestAwards(thisWeek);
      const seenKey = `awards_seen_${pid}_${newest}`;
      const seen = localStorage.getItem(seenKey);
      if (!seen) {
        // avoid two overlays at once
        setPromptOpen(false);
        setAwardsOpen(true);
      }
    })();
  }, [canUse, pid]);

  function closeAwards() {
    if (latestWeek) localStorage.setItem(`awards_seen_${pid}_${latestWeek}`, "1");
    setAwardsOpen(false);
    // resume prompt if there are still rewards queued
    setPromptOpen((p) => (queue.length ? true : p));
  }

  // ---------------- Claim handlers ----------------
  async function claim(kind) {
    if (!canUse || busy) return;
    setBusy(true);
    try {
      if (kind === "weekly") {
        await supabase.functions.invoke("claim-weekly", { body: { user_id: pid } });
      } else if (kind === "streak") {
        await supabase.functions.invoke("claim-streak", { body: { user_id: pid } });
      } else if (kind === "free") {
        await supabase.functions.invoke("claim-free-pick", { body: { user_id: pid } });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("claim error", e);
    } finally {
      // remove this kind from queue and maybe close prompt
      setQueue((q) => q.filter((k) => k !== kind));
      setBusy(false);
      setPromptOpen((p) => (queue.length - 1 > 0 ? true : false));
      // refresh progress/eligibility after claim
      check();
    }
  }

  // ---------------- Render ----------------
  return (
    <>
      {/* Awards overlay (auto-opens once per player/week) */}
      {awardsOpen && (
        <div className="fixed inset-0 z-[96] grid place-items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="relative w-[92vw] max-w-xl rounded-2xl border border-white/15 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Weekly Awards {latestWeek ? `(${latestWeek})` : ""}</div>
              <button onClick={closeAwards} className="text-sm px-3 py-1 rounded bg-black/5 hover:bg-black/10">Close</button>
            </div>
            <div className="grid gap-3">
              {latestAwards.map((a) => {
                const meta = TROPHY_META[a.trophy_code] || { title: a.trophy_code, icon: "/trophies/high_score.png" };
                return (
                  <div key={a.trophy_code} className="flex items-center gap-4 p-4 rounded-2xl border border-black/5 bg-white/80">
                    <img src={meta.icon} alt={meta.title} className="w-16 h-16 rounded-xl object-contain" />
                    <div>
                      <div className="text-base font-semibold">{meta.title}</div>
                      <div className="text-sm opacity-70 space-x-3">
                        {a.metrics?.effort_score != null && <span>Score: {a.metrics.effort_score}</span>}
                        {a.metrics?.minutes != null && <span>Minutes: {a.metrics.minutes}</span>}
                        {a.metrics?.points != null && <span>Points: {a.metrics.points}</span>}
                      </div>
                      {a.metrics?.first_pb && (
                        <div className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          First ever PB!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={closeAwards} className="rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white">
                Nice!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rewards prompt (weekly / streak / free) */}
      {promptOpen && queue.length > 0 && (
        <div className="fixed inset-0 z-[95] grid place-items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="relative w-[92vw] max-w-md rounded-2xl border border-white/15 bg-black/80 p-5 text-white shadow-xl">
            <div className="mb-2 text-lg font-semibold">Rewards available</div>
            <div className="space-y-2">
              {queue.includes("weekly") && (
                <button
                  onClick={() => claim("weekly")}
                  disabled={busy}
                  className="w-full rounded-xl bg-indigo-500/90 px-4 py-3 font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  Claim Weekly Reward
                </button>
              )}
              {queue.includes("streak") && (
                <button
                  onClick={() => claim("streak")}
                  disabled={busy}
                  className="w-full rounded-xl bg-amber-500/90 px-4 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50"
                >
                  Claim Streak Reward
                </button>
              )}
              {queue.includes("free") && (
                <button
                  onClick={() => claim("free")}
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {nextFreePickAt ? `Free Pick in ${countdown.current}` : "Claim Free Pick"}
                </button>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setPromptOpen(false)} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
