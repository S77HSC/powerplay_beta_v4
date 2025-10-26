// lobbycomponents/FreePickPill.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/** Format ms → HH:MM:SS (or "Ready") */
function fmt(ms) {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Props:
 *  - player_id / playerId / playerid: number
 *  - className: controls outer width from parent (e.g., "w-[320px] sm:w-[360px]")
 *  - radius: "tight" | "pill"  (tight = sharper corners + tighter glow)
 */
export default function FreePickPill({
  player_id,
  playerId,
  playerid,
  className = "",
  radius = "tight",
}) {
  // accept any common prop spellings
  const pid = useMemo(() => Number(player_id ?? playerId ?? playerid), [player_id, playerId, playerid]);
  const canUse = Number.isFinite(pid);

  const [nextAt, setNextAt] = useState(null);
  const [label, setLabel] = useState("00:00:00");
  const tickRef = useRef(null);

  // initial load
  useEffect(() => {
    if (!canUse) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("next_free_pick_at")
        .eq("player_id", pid)
        .maybeSingle();
      if (!alive) return;
      if (error) { setNextAt(null); return; }
      setNextAt(data?.next_free_pick_at ?? null);
    })();
    return () => { alive = false; };
  }, [canUse, pid]);

  // realtime
  useEffect(() => {
    if (!canUse) return;
    const ch = supabase
      .channel(`freepick_user_progress_${pid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_progress", filter: `player_id=eq.${pid}` },
        (payload) => setNextAt(payload.new?.next_free_pick_at ?? null)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canUse, pid]);

  // ticking
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!nextAt) { setLabel("Ready"); return; }
    const target = new Date(nextAt).getTime();
    const tick = () => setLabel(fmt(target - Date.now()));
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [nextAt]);

  if (!canUse) return null;

  const ready = !nextAt || new Date(nextAt) <= new Date();

  // radius + aura presets
  const rClass     = radius === "tight" ? "rounded-2xl" : "rounded-full";
  const auraInset  = radius === "tight" ? "-inset-[2px]" : "-inset-1";
  const auraBlur   = radius === "tight" ? "blur-md" : "blur-lg";
  const outlineCol = "ring-2 ring-black/60";

  return (
    <div
      className={`relative w-full ${className}`}
      aria-live="polite"
      title={nextAt ? `Next free pick at ${new Date(nextAt).toLocaleString()}` : "Free Pick is ready"}
    >
      {/* Neon aura (tighter when radius='tight') */}
      <div
        className={`absolute ${auraInset} ${rClass} ${auraBlur} opacity-85`}
        style={{ background: "conic-gradient(from 0deg,#00f5ff,#22c55e,#a855f7,#00f5ff)" }}
      />
      {/* Outline */}
      <div className={`absolute inset-0 ${rClass} ${outlineCol} pointer-events-none`} />

      {/* Pill body */}
      <div
        className={`relative w-full ${rClass} px-4 py-2.5 overflow-hidden backdrop-blur-lg ring-1 shadow-[0_10px_28px_rgba(0,0,0,.55)]
        ${ready ? "bg-emerald-900/60 ring-emerald-300/20" : "bg-amber-900/55 ring-amber-300/20"}`}
      >
        {/* Centered row (wraps on small widths) */}
        <div className="relative flex flex-wrap items-center justify-center gap-2 text-center min-w-0 mx-auto">
          {/* Contrast plate behind text line */}
          <div
            className="pointer-events-none absolute -z-10 left-1/2 -translate-x-1/2 -top-2 bottom-2 rounded-[18px]"
            style={{
              width: "calc(100% - 0.75rem)",
              background: "linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,.35))",
              filter: "blur(1.2px)",
            }}
          />

          {/* Icon */}
          <div
            className={`grid place-items-center w-8 h-8 rounded-full ring-1 ring-black/60 shadow-[0_0_22px_rgba(245,158,11,.9)]
            ${ready ? "bg-gradient-to-br from-emerald-400 to-teal-500" : "bg-gradient-to-br from-amber-400 to-pink-500"}`}
          >
            <span className="text-xl" style={{ textShadow: "0 0 12px rgba(255,255,255,.9)" }}>🎁</span>
          </div>

          {/* Label + chip + timer */}
          <span
            className="font-semibold tracking-wide text-white"
            style={{ textShadow: "0 2px 2px rgba(0,0,0,.9)" }}
          >
            Free Pick
          </span>

          <span
            className={`text-[10px] uppercase tracking-wide text-white/95 px-2 py-[2px] rounded-full border
            ${ready ? "bg-black/60 border-white/10 animate-fp-pulse" : "bg-black/50 border-white/10"}`}
          >
            {ready ? "Ready" : "In"}
          </span>

          {!ready && (
            <span className="font-mono tabular-nums text-white">
              {label}
            </span>
          )}
        </div>
      </div>

      {/* Local keyframes */}
      <style jsx>{`
        @keyframes fp-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,.7); }
          100% { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
        }
        .animate-fp-pulse { animation: fp-pulse 1.6s ease-out infinite; }
      `}</style>
    </div>
  );
}
