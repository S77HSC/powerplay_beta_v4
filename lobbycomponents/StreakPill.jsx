// StreakPill.jsx — boosted text contrast (dark plate + goal chip)
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function StreakPill({
  playerId: propPlayerId,
  goalDays = 7,
  className = "",
}) {
  const [playerId, setPlayerId] = useState(propPlayerId ?? null);
  const [days, setDays] = useState(0);

  // resolve player id from auth if not passed
  useEffect(() => {
    if (propPlayerId != null) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      if (!error && !cancelled) setPlayerId(data?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [propPlayerId]);

  // load + realtime
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("players")
        .select("current_streak")
        .eq("id", playerId)
        .single();
      if (!error && !cancelled) setDays(data?.current_streak ?? 0);
    };

    load();

    const channel = supabase
      .channel(`players:${playerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `id=eq.${playerId}` },
        (payload) => setDays(payload.new?.current_streak ?? 0)
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [playerId]);

  const pct = Math.min(100, Math.round((Math.min(days, goalDays) / goalDays) * 100));
  const hitGoal = days >= goalDays;

  return (
    <div className={`relative w-full ${className}`}>
      {/* aura + outline (unchanged) */}
      <div className="absolute -inset-1 rounded-full blur-lg opacity-90"
           style={{ background: "conic-gradient(from 0deg,#00f5ff,#22c55e,#a855f7,#00f5ff)" }} />
      <div className="absolute inset-0 rounded-full ring-2 ring-black/55 pointer-events-none" />

      {/* body */}
      <div className="relative flex items-center gap-3 rounded-full px-5 py-3 backdrop-blur-lg bg-slate-950/70 shadow-[0_10px_28px_rgba(0,0,0,.55)] ring-1 ring-white/10">
        {/* flame */}
        <div className="grid place-items-center w-10 h-10 rounded-full ring-1 ring-black/60 bg-gradient-to-br from-amber-400 to-pink-500 shadow-[0_0_28px_rgba(245,158,11,.9)]">
          <span className="text-2xl" style={{ textShadow: "0 0 14px rgba(255,255,255,.9)" }}>🔥</span>
        </div>

        {/* text + progress */}
        <div className="relative flex flex-col min-w-[240px]">
          {/* CONTRAST PLATE behind the text line */}
          <div
            className="pointer-events-none absolute -inset-x-2 -top-1 h-7 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 65%, rgba(0,0,0,0) 100%)",
              filter: "blur(2px)",
            }}
          />

          <div className="relative flex items-center gap-2">
            <span
              className="font-semibold tracking-wide text-white"
              style={{ textShadow: "0 2px 2px rgba(0,0,0,.9)" }}
            >
              Streak: {days} day{days === 1 ? "" : "s"}
            </span>

            {/* GOAL CHIP (ensures readability on light green) */}
            <span className="text-[10px] uppercase tracking-wide text-white/95 px-2 py-[2px] rounded-full bg-black/50 border border-white/10">
              {hitGoal ? "Goal hit!" : `to ${goalDays}-day target`}
            </span>
          </div>

          {/* track + fill (with inner neon flow) */}
          <div className="relative mt-2 h-3 w-full rounded-full overflow-hidden bg-slate-900 ring-1 ring-black/60">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg,#00f5ff 0%,#22c55e 50%,#a855f7 100%)",
                boxShadow: "0 0 18px rgba(34,197,94,.75), 0 0 36px rgba(168,85,247,.45)",
              }}
            />
            <div
              className="absolute top-0 left-0 h-full pointer-events-none mix-blend-screen"
              style={{
                width: `${pct}%`,
                background:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0px, rgba(255,255,255,0) 12px, rgba(255,255,255,.22) 24px)",
                filter: "blur(4px)",
                animation: "glow-flow 1.8s linear infinite",
              }}
            />
          </div>
        </div>

        {hitGoal && (
          <div className="ml-1 text-xs font-extrabold px-2 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black ring-1 ring-black/50 shadow-[0_0_24px_rgba(236,72,153,.9)]">
            BONUS READY
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes glow-flow {
          0% { transform: translateX(0); }
          100% { transform: translateX(40px); }
        }
      `}</style>
    </div>
  );
}
