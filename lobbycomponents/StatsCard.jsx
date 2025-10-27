// /lobbycomponents/StatsCard.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { supabase } from "../lib/supabase"; // keep your existing client import

export default function StatsCard({ stats, player_id, orbitronClass = "" }) {
  const [series, setSeries] = useState([]); // 14pt sparkline
  const [open, setOpen] = useState(false);

  // ------- animated KPI values -------
  const winsMV = useCountUp(stats?.wins ?? 0);
  const goalsMV = useCountUp(stats?.goals ?? 0);
  const sessionsMV = useCountUp(stats?.sessions ?? 0);

  // ------- fetch optional trend series (fallback to flat) -------
  useEffect(() => {
    let safe = true;
    (async () => {
      if (!player_id) {
        const s = Math.max(0, Number(stats?.sessions || 0));
        setSeries(Array.from({ length: 14 }, () => Math.round(s / 14)));
        return;
      }
      const { data, error } = await supabase
        .from("player_stats_v")
        .select("sessions_7d, sessions_prev7")
        .eq("player_id", player_id)
        .maybeSingle();

      if (!safe) return;

      if (!error && data) {
        const a = Number(data.sessions_prev7 || 0);
        const b = Number(data.sessions_7d || 0);
        const prev = Array.from({ length: 7 }, () => Math.max(0, Math.round(a / 7)));
        const cur = Array.from({ length: 7 }, () => Math.max(0, Math.round(b / 7)));
        setSeries([...prev, ...cur]);
      } else {
        const s = Math.max(0, Number(stats?.sessions || 0));
        setSeries(Array.from({ length: 14 }, () => Math.round(s / 14)));
      }
    })();
    return () => {
      safe = false;
    };
  }, [player_id, stats?.sessions]);

  // ------- close with ESC + lock scroll while open -------
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ------- sparkline + trend -------
  const trend = useMemo(() => {
    if (series.length < 14) return null;
    const a = series.slice(0, 7).reduce((s, n) => s + n, 0);
    const b = series.slice(7).reduce((s, n) => s + n, 0);
    if (a === 0 && b === 0) return { pct: 0, up: false };
    const pct = a === 0 ? 100 : Math.round(((b - a) / Math.max(1, a)) * 100);
    return { pct: Math.abs(pct), up: b >= a };
  }, [series]);

  const spark = useMemo(() => {
    if (!series.length) return "";
    const w = 120,
      h = 36,
      pad = 2;
    const max = Math.max(1, ...series);
    const step = (w - pad * 2) / (series.length - 1);
    return series
      .map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - (v / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series]);

  return (
    <>
      {/* Neon ring + glass body */}
      <motion.div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,.55)" }}
        onClick={() => setOpen(true)}
        className="relative cursor-pointer rounded-2xl p-[2px] shadow-[0_10px_30px_rgba(0,0,0,.35)]"
        style={{
          background:
            "conic-gradient(from 160deg, rgba(56,189,248,.65), rgba(168,85,247,.55), rgba(56,189,248,.65))",
        }}
      >
        <div className="rounded-2xl bg-black/70 backdrop-blur-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div className={`text-sm uppercase tracking-wide text-cyan-300 ${orbitronClass}`}>
              Player Stats
            </div>
            <Badge text={`Lvl ${stats?.level ?? "–"}`} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <Kpi label="Wins" value$={winsMV} />
            <Kpi label="Goals" value$={goalsMV} />
            <Kpi label="Sessions" value$={sessionsMV} />
          </div>

          {/* Streak chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon="🔥" text={`Current ${stats?.currentStreak ?? 0}`} />
            <Chip icon="🏆" text={`Best ${stats?.longestStreak ?? 0}`} />
          </div>

          {/* Sparkline + trend */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/80">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                📈
              </span>
              <span>Last 14 days</span>
              {trend && (
                <span className={trend.up ? "text-emerald-400" : "text-rose-400"}>
                  {trend.up ? "▲" : "▼"} {trend.pct}%
                </span>
              )}
            </div>
            <svg viewBox="0 0 120 36" className="h-6 w-[120px] overflow-visible">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <path d={spark} fill="none" stroke="url(#g1)" strokeWidth="2" />
            </svg>
          </div>

          <div className="mt-3 text-right">
            <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
              View breakdown
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                <path
                  fill="currentColor"
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>

        {/* Soft outer glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[28px] blur-2xl opacity-30"
          style={{
            background:
              "radial-gradient(120px 80px at 80% 10%, rgba(56,189,248,.65), transparent 60%), radial-gradient(140px 100px at 20% 90%, rgba(168,85,247,.5), transparent 60%)",
          }}
        />
      </motion.div>

      {/* Slide-out dashboard (overlay + drawer) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Dimmed backdrop (click to close) */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: 440 }}
              animate={{ x: 0 }}
              exit={{ x: 440 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="absolute right-0 top-0 h-full w-[420px] bg-black/90 border-l border-white/10 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <h3 className={`text-lg text-white ${orbitronClass}`}>Player Dashboard</h3>
              <p className="mt-1 text-sm text-white/70">Your recent form & efficiency.</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Mini stat="Win rate" value={rate(stats?.wins, stats?.sessions)} suffix="%" />
                <Mini stat="Goals / session" value={ratio(stats?.goals, stats?.sessions)} />
                <Mini stat="Current streak" value={stats?.currentStreak ?? 0} />
                <Mini stat="Best streak" value={stats?.longestStreak ?? 0} />
                <Mini stat="Total goals" value={stats?.goals ?? 0} />
                <Mini stat="Total sessions" value={stats?.sessions ?? 0} />
              </div>

              <div className="mt-6 text-xs text-white/60">
                Tip: keep a 7-day activity streak to boost XP and multiplier bonuses.
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- subcomponents & helpers ---------------- */

function Kpi({ label, value$ }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-[11px] uppercase text-white/70">{label}</div>
      <motion.div className="mt-1 text-2xl font-semibold text-white">
        <motion.span>{value$}</motion.span>
      </motion.div>
    </div>
  );
}

function Chip({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/10 text-white/80 text-xs px-2 py-1 border border-white/10">
      <span className="opacity-90">{icon}</span>
      {text}
    </span>
  );
}

function Badge({ text }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-cyan-500/15 text-cyan-200 text-[11px] px-2 py-1 ring-1 ring-cyan-400/30">
      {text}
    </span>
  );
}

function Mini({ stat, value, suffix = "" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-white/70">{stat}</div>
      <div className="text-white text-lg">
        {Number.isFinite(Number(value)) ? value : "–"}
        {suffix}
      </div>
    </div>
  );
}

function useCountUp(value) {
  const mv = useMotionValue(0);
  useEffect(() => {
    const controls = animate(mv, Number(value || 0), { duration: 0.6, ease: "easeOut" });
    return () => controls.stop();
  }, [value]);
  return useTransform(mv, (v) => Math.round(v));
}

function rate(a, b) {
  const A = Number(a || 0),
    B = Number(b || 0);
  return B ? Math.round((A / B) * 100) : 0;
}
function ratio(a, b) {
  const A = Number(a || 0),
    B = Number(b || 0);
  return B ? (A / B).toFixed(2) : "0.00";
}
