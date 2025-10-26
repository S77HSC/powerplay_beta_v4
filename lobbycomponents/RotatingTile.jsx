"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/**
 * items: [{ id,title,subtitle,badge,cta_text,cta_href,start_at,end_at,accent_from,accent_to,trophy_url }]
 * size: "sm" | "md" | "lg"
 */
export default function RotatingTile({ items, intervalMs = 6000, size = "md" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const active = Array.isArray(items) ? items.filter(Boolean) : [];
  const next = useCallback(() => setIndex(i => (active.length ? (i + 1) % active.length : 0)), [active.length]);

  useEffect(() => { if (index >= active.length && active.length > 0) setIndex(0); }, [active.length, index]);

  useEffect(() => {
    if (!active.length || paused) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(next, intervalMs);
    return () => clearTimeout(timer.current);
  }, [active.length, paused, index, intervalMs, next]);

  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { setPaused(true); next(); }
    if (e.key === "ArrowLeft")  { setPaused(true); setIndex(i => (i - 1 + active.length) % active.length); }
  };

  if (!active.length) return null;
  const current = active[index];

  // Fixed heights + hard cap for trophy so nothing can resize the tile
  const SIZES = {
    sm: { h: "h-[120px]", padRight: "pr-24", trophyMaxH: "max-h-[84px]" },
    md: { h: "h-[140px]", padRight: "pr-28", trophyMaxH: "max-h-[96px]" },
    lg: { h: "h-[160px]", padRight: "pr-32", trophyMaxH: "max-h-[112px]" },
  };
  const S = SIZES[size] ?? SIZES.md;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown} tabIndex={0} aria-roledescription="carousel" aria-label="Featured events"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={current.id ?? index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28 }}
          className={`relative grid ${S.h} grid-cols-12 gap-4 p-5 overflow-hidden`}
          /* 👉 gradient only; DO NOT use current.image_url as a background */
          style={{
            background: `linear-gradient(135deg, ${current.accent_from || "#06b6d4"}, ${current.accent_to || "#3b82f6"})`,
          }}
        >
          {/* Text */}
          <div className={`relative z-[1] col-span-12 ${S.padRight} text-white min-w-0`}>
            {current.badge && (
              <span className="inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] uppercase tracking-widest">
                {current.badge}
              </span>
            )}
            <h3 className="mt-2 font-arena text-base md:text-lg tracking-wide3 uppercase truncate">
              {current.title}
            </h3>
            {current.subtitle && (
              <p className="mt-1 text-xs md:text-sm text-white/85 line-clamp-2">
                {current.subtitle}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {current.cta_href && (
                <Link
                  href={current.cta_href}
                  className="rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black hover:brightness-95 focus:outline-none focus-visible:ring focus-visible:ring-yellow-300/50"
                  prefetch
                >
                  {current.cta_text || "Learn more"}
                </Link>
              )}
              <TimeLeft startAt={current.start_at} endAt={current.end_at} />
            </div>
          </div>

          {/* Trophy – bottom-right, fully contained */}
          {current.trophy_url && (
            <motion.img
              src={current.trophy_url}
              alt=""
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-2 right-3 w-auto ${S.trophyMaxH} object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.05 }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
        {active.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => { setPaused(true); setIndex(i); }}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-2 bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

function TimeLeft({ startAt, endAt }) {
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force(n => (n + 1) % 1e9), 30000); return () => clearInterval(id); }, []);
  const now = Date.now(), s = startAt ? Date.parse(startAt) : null, e = endAt ? Date.parse(endAt) : null;
  let label = null;
  if (s && now < s) label = `Starts in ${fmtLeft(s - now)}`;
  else if (e && now < e) label = `Ends in ${fmtLeft(e - now)}`;
  else if (e && now >= e) label = "Ended";
  if (!label) return null;
  return <span className="text-xs text-white/80">{label}</span>;
}
function fmtLeft(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}
