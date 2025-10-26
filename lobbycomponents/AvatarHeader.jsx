// lobbycomponents/AvatarHeader.jsx
"use client";

import { motion } from "framer-motion";

export default function AvatarHeader({
  orbitronClass,
  currentXP = 0,
  nextXP = 100,
  barClassName = "w-[560px] max-w-[90vw]", // control bar width from parent if needed
}) {
  const req = Math.max(1, Number(nextXP));
  const cur = Math.max(0, Number(currentXP));
  const pct = Math.min(100, Math.max(0, Math.round((cur / req) * 100)));
  const toGo = Math.max(0, req - cur);

  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Avatar + glow */}
      <div className="relative mb-4">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow:
              "0 0 28px #ff6a00, 0 0 60px #ff4500, 0 0 90px rgba(255,69,0,0.35)",
          }}
        />
        <div className="h-40 w-40 rounded-full border-4 border-yellow-400 bg-gray-700" />
      </div>

      <h2 className={`${orbitronClass} text-3xl text-white drop-shadow-[0_0_8px_#00f6ff]`}>
        Player
      </h2>

      {/* ===== GLAM LEVEL / XP BAR ===== */}
      <div className={`relative ${barClassName}`}>
        {/* Title row + chip */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-white/90 tracking-wide text-sm">LEVEL</span>
          <span className="text-[10px] uppercase tracking-wide text-white/95 px-2 py-[2px] rounded-full bg-black/50 border border-white/10">
            {toGo} XP to next
          </span>
        </div>

        {/* Numbers */}
        <div className="text-white/85 text-[12px] text-center mt-1">
          {cur} / {req} XP
        </div>

        {/* Aura behind the bar */}
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-3 h-[18px] w-[92%] rounded-full blur-lg opacity-90"
          style={{ background: "conic-gradient(from 0deg,#00f5ff,#22c55e,#a855f7,#00f5ff)" }}
          aria-hidden
        />

        {/* Hard outline */}
        <div className="mt-3 h-[18px] w-full rounded-full ring-2 ring-black/55 pointer-events-none" aria-hidden />

        {/* Track */}
        <div
          className="relative -mt-[18px] h-[18px] w-full rounded-full overflow-hidden bg-slate-950/70 ring-1 ring-white/10 backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,.45)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={req}
          aria-valuenow={cur}
          aria-label="Level progress"
          title={`${pct}%`}
        >
          {/* Fill */}
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              background:
                "linear-gradient(90deg,#00f5ff 0%, #22c55e 50%, #a855f7 100%)",
              boxShadow:
                "0 0 18px rgba(34,197,94,.75), 0 0 36px rgba(168,85,247,.45)",
            }}
          />

          {/* Flowing glow (clipped to fill) */}
          <div
            className="absolute inset-y-0 left-0 pointer-events-none mix-blend-screen"
            style={{
              width: `${pct}%`,
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0px, rgba(255,255,255,0) 12px, rgba(255,255,255,.22) 24px)",
              filter: "blur(4px)",
              animation: "lvl-flow 1.8s linear infinite",
            }}
          />

          {/* Spark at current progress */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full pointer-events-none"
            style={{
              left: `calc(${pct}% - 6px)`,
              background:
                "radial-gradient(circle, #ffffff 0%, #a855f7 55%, rgba(168,85,247,0) 70%)",
              boxShadow:
                "0 0 16px rgba(168,85,247,.9), 0 0 26px rgba(34,197,94,.6)",
            }}
          />
        </div>

        {/* subtle ticks every 10% */}
        <div
          className="mt-1 h-[2px] w-full opacity-30"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 1px, rgba(255,255,255,0) 1px 10%)",
          }}
          aria-hidden
        />

        {/* local keyframes */}
        <style jsx>{`
          @keyframes lvl-flow {
            0% { transform: translateX(0); }
            100% { transform: translateX(40px); }
          }
        `}</style>
      </div>
    </motion.div>
  );
}
