// app/skill-session/SessionCompleteModal.jsx
"use client";

import { useEffect, useMemo } from "react";

export default function SessionCompleteModal({
  open,
  onClose,
  xp = 0,
  points = 0,
  pointsLabel = "", // empty string hides the right-hand card
  summary = "",
  loading = false,
  stats = { reps: 0, touches: 0, workSeconds: 0, restSeconds: 0, totalSeconds: 0 },
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent background scroll when open
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow || "";
    };
  }, [open]);

  const cleanSummary = useMemo(() => (summary || "").trim(), [summary]);

  const fmtTime = (s = 0) => {
    const m = Math.floor(s / 60);
    const sec = Math.max(0, Math.floor(s % 60));
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-complete-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div className="relative z-[101] w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 id="session-complete-title" className="text-lg font-semibold tracking-tight">
              Session Complete
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            Close
          </button>
        </div>

        {/* Numbers */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* XP (always shown) */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/20 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-white/70">XP</div>
            <div className="mt-1 text-4xl font-black tabular-nums">
              {loading ? <SkeletonLine widthClass="w-16" /> : Math.max(0, Math.floor(xp))}
            </div>
            <div className="mt-1 text-xs text-white/60">Earned this session</div>
            <Shine />
          </div>

          {/* Secondary points (optional) */}
          {pointsLabel ? (
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-fuchsia-500/10 to-emerald-500/20 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/70">
                {pointsLabel}
              </div>
              <div className="mt-1 text-4xl font-black tabular-nums">
                {loading ? <SkeletonLine widthClass="w-16" /> : Math.max(0, Math.floor(points))}
              </div>
              <div className="mt-1 text-xs text-white/60">Total this session</div>
              <Shine />
            </div>
          ) : null}
        </div>

        {/* Stats grid */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Reps" value={stats?.reps ?? 0} loading={loading} />
          <StatCard label="Touches" value={stats?.touches ?? 0} loading={loading} />
          <StatCard
            label="Work"
            value={fmtTime(stats?.workSeconds ?? 0)}
            mono
            loading={loading}
          />
          <StatCard
            label="Rest"
            value={fmtTime(stats?.restSeconds ?? 0)}
            mono
            loading={loading}
          />
        </div>

        {/* Summary */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-white/70">Summary</div>
          <div className="text-sm leading-relaxed text-white/90">
            {loading ? (
              <div className="space-y-2">
                <SkeletonLine />
                <SkeletonLine />
                <SkeletonLine widthClass="w-3/5" />
              </div>
            ) : cleanSummary ? (
              cleanSummary
            ) : (
              <span className="text-white/50">Nice! Keep stacking sessions to see trends.</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/50">
            Pro tip: XP here comes from your <span className="font-medium">XR</span> in the DB.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-neutral-900 hover:bg-white/90"
            >
              Continue
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(cleanSummary || "")}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
            >
              Copy Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small presentational helpers ---------- */

function StatCard({ label, value, mono = false, loading = false }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-white/70">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${
          mono ? "tabular-nums font-mono tracking-tight" : "tabular-nums"
        }`}
      >
        {loading ? <SkeletonLine widthClass="w-10" /> : value}
      </div>
    </div>
  );
}

function SkeletonLine({ widthClass = "w-24" }) {
  return <div className={`h-4 animate-pulse rounded bg-white/10 ${widthClass}`} />;
}

function Shine() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      <div className="absolute -inset-y-8 -left-16 h-24 w-24 rotate-12 bg-white/10 blur-2xl" />
      <div className="absolute -inset-y-10 -right-12 h-24 w-24 -rotate-12 bg-white/10 blur-2xl" />
    </div>
  );
}
