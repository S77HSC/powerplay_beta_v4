// lobbycomponents/WeeklyTrophiesWidget.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

/* ----------------------------------------------------------------------------
   Helpers
---------------------------------------------------------------------------- */

const PLAYER_FIELDS = "id,name,avatar_url,equipped_items";

// Turn a storage key into a public URL (bucket defaults to `avatars`)
function getAvatarPublicUrl(key) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || String(key).startsWith("/")) return key; // already URL or local
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars").replace(/\/*$/g, "");
  const normalized = String(key).replace(/^\/*/, "").replace(/^avatars\//, "");
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

// Format seconds → "Xh Ym"
const formatTime = (secs) => {
  const s = Math.max(0, Number(secs) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Name resolver
const resolveName = (p, r) =>
  r?.player_name || p?.name || `Player ${r?.player_id ?? p?.id ?? ""}`;

// Avatar resolver: players.avatar_url → equipped_items.card.avatarUrl → storage key → fallback
const resolveAvatar = (p, r) => {
  const equipped = (() => {
    try {
      const obj =
        typeof p?.equipped_items === "string"
          ? JSON.parse(p.equipped_items || "{}")
          : p?.equipped_items || {};
      const card = obj.card || {};
      return card.avatarUrl || card.imageUrl || null;
    } catch {
      return null;
    }
  })();

  const raw = r?.player_avatar_url || p?.avatar_url || equipped || "";
  if (raw && (/^https?:\/\//i.test(raw) || String(raw).startsWith("/"))) return raw;

  const normalized = String(raw).replace(/^\/*/, "").replace(/^avatars\//, "");
  const url = getAvatarPublicUrl(normalized);
  return url || "/characters/striker_base.png";
};

// Reusable circular avatar
function Avatar({ src, size = 44, ringClass = "ring-cyan-300/40", title = "" }) {
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-black/30 ring-2 ${ringClass}`}
      style={{ width: size, height: size }}
      title={title}
    >
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover rounded-full"
        onError={(e) => {
          e.currentTarget.src = "/characters/striker_base.png";
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Main widget
---------------------------------------------------------------------------- */

export default function WeeklyTrophiesWidget({
  mode = "ticker", // "ticker" | "panel"
  timezone = "Europe/London",
  limit = 10,
  minHeight = 220,
  weekStartOverride,
  // ticker-only
  speed = 48,
  height,
}) {
  const [rows, setRows] = useState([]);
  const [players, setPlayers] = useState({});
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [showTop10, setShowTop10] = useState(false);
  const alive = useRef(true);

  // previous completed Monday (in tz)
  const lastMondayISO = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [dd, mm, yyyy] = fmt.format(new Date()).split("/");
    const tzMidnight = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    const mondayOffset = (tzMidnight.getUTCDay() + 6) % 7;
    const monday = new Date(tzMidnight);
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    monday.setUTCDate(monday.getUTCDate() - 7);
    return monday.toISOString().slice(0, 10);
  }, [timezone]);

  /* ---------------- data ---------------- */

  const hydratePlayers = useCallback(async (list) => {
    const ids = [...new Set(list.map((r) => r.player_id).filter(Boolean))];
    if (!ids.length) {
      setPlayers({});
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_FIELDS)
      .in("id", ids);

    if (error) {
      setPlayers({});
      return;
    }

    setPlayers(Object.fromEntries((data ?? []).map((p) => [p.id, p])));
  }, []);

  const fetchWeek = useCallback(
    async (weekStartISO) => {
      const baseSel =
        "player_id, week_start, minutes, points, effort_score, effort_tier";
      const withLink = `${baseSel}, link_url`;

      const run = (sel) =>
        supabase
          .from("v_weekly_training")
          .select(sel)
          .eq("week_start", weekStartISO)
          .not("player_id", "is", null)
          .order("effort_score", { ascending: false })
          .order("minutes", { ascending: false })
          .limit(limit);

      let data = [];
      let error = null;
      let resp = await run(withLink);
      data = resp.data || [];
      error = resp.error || null;
      if (error) {
        const missing =
          String(error.code || "").includes("42703") ||
          /does not exist/i.test(String(error.message || ""));
        if (missing) {
          resp = await run(baseSel);
          data = resp.data || [];
          error = resp.error || null;
        }
      }
      return { data, error };
    },
    [limit]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let target = weekStartOverride || lastMondayISO;

    let { data, error } = await fetchWeek(target);

    // fallback to latest available week if target is empty
    if (!error && data.length === 0) {
      const probe = await supabase
        .from("v_weekly_training")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1);
      const latestKey = probe.data?.[0]?.week_start;
      if (latestKey) {
        target = latestKey;
        const res = await fetchWeek(latestKey);
        data = res.data;
        error = res.error;
      }
    }

    if (error) {
      if (alive.current) {
        setRows([]);
        setPlayers({});
        setLabel("Error loading");
        setLoading(false);
      }
      return;
    }

    if (alive.current) {
      setRows(data);
      setLabel(`Week starting ${new Date(target).toLocaleDateString()}`);
    }

    await hydratePlayers(data);
    if (alive.current) setLoading(false);
  }, [fetchWeek, hydratePlayers, lastMondayISO, weekStartOverride]);

  useEffect(() => {
    alive.current = true;
    fetchAll();
    const onVis = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchAll]);

  /* ---------------- render variants ---------------- */

  if (mode === "ticker") {
    return (
      <>
        <div className="mb-1 flex items-center justify-between px-2 relative z-[80] pointer-events-auto">
          <button
            onClick={() => setShowTop10(true)}
            className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[15px] font-semibold tracking-wide text-cyan-200 hover:bg-cyan-500/25"
            title="View Top 10"
          >
            {loading ? "Loading…" : label || "Weekly Effort"}
          </button>
          <button
            onClick={() => setShowTop10(true)}
            className="rounded-md border border-white/15 bg-white/10 px-3 py-1 text-[14px] text-white hover:bg-white/15"
            title="View Top 10"
          >
            Top 10
          </button>
        </div>

        <Ticker
          rows={rows}
          players={players}
          height={height ?? Math.max(40, Math.min(52, minHeight))}
          speed={speed}
        />

        <Top10Modal
          open={showTop10}
          onClose={() => setShowTop10(false)}
          label={label}
          rows={rows.slice(0, 10)}
          players={players}
        />
      </>
    );
  }

  // (Optional) panel list view
  const estimatedRowH = 56;
  const baseChrome = 112;
  const dynamicMin = rows.length
    ? Math.max(minHeight, baseChrome + estimatedRowH * Math.min(rows.length, limit))
    : minHeight;

  const topPanelEffort = Math.max(1, ...rows.map((r) => Number(r.effort_score) || 0));

  return (
    <>
      <div
        className="mb-4 relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0b1220] via-[#0b1220]/90 to-[#0d1730] p-0 shadow-[0_16px_46px_-14px_rgba(56,189,248,0.36)]"
        style={{ minHeight: dynamicMin }}
      >
        <div
          className="pointer-events-none absolute -inset-[1px] rounded-2xl"
          style={{ boxShadow: "0 0 70px rgba(56,189,248,0.24) inset" }}
        />

        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <div>
            <div className="text-[16px] font-semibold tracking-wide text-cyan-300 uppercase drop-shadow">
              Weekly Effort
            </div>
            <div className="text-[12px] text-white/80">{label}</div>
          </div>
          <button
            onClick={() => setShowTop10(true)}
            className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-[14px] text-white hover:bg-white/15"
          >
            View Top 10
          </button>
        </div>

        <div className="relative mx-4 mt-2 h-[2px] overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-0 animate-[shimmer_2.2s_linear_infinite]" />
        </div>

        <div className="relative z-10 px-4 pt-4 pb-4">
          {loading ? (
            <div className="py-6 text-center text-[14px] text-white/85">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-[14px] text-white/85">
              No data found.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r, idx) => {
                const p = players[r.player_id] || {};
                const pct = Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((Number(r.effort_score) || 0) / topPanelEffort) * 100)
                  )
                );
                const medal =
                  idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                return (
                  <li
                    key={`${r.player_id}-${r.week_start}`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 ring-1 ring-black/40 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-[18px]">
                          {medal}
                        </div>
                        <Avatar
                          src={resolveAvatar(p, r)}
                          size={44}
                          ringClass="ring-cyan-300/35"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-white">
                            {resolveName(p, r)}
                            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/70">
                              {String(p?.effort_tier || r?.effort_tier || "")
                                .toUpperCase() || "—"}
                            </span>
                          </div>
                          <div className="text-[12px] text-white/80">
                            Effort {r.effort_score?.toLocaleString?.() ?? r.effort_score} •
                            Time {formatTime(r.minutes)} • Points {r.points ?? 0}
                          </div>
                        </div>
                      </div>

                      <div className="hidden sm:block min-w-[160px]">
                        <div className="h-[10px] rounded-full bg-white/10">
                          <div
                            className="h-[10px] rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400"
                            style={{ width: `${pct}%` }}
                            title={`${pct}% of #1`}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end px-4 pb-4">
          <div className="text-[11px] text-white/70">Refreshes on focus</div>
        </div>

        <style jsx>{`
          @keyframes shimmer {
            0% {
              background: linear-gradient(
                180deg,
                transparent 0%,
                rgba(255, 255, 255, 0.45) 50%,
                transparent 100%
              );
              transform: translateX(-100%);
            }
            100% {
              background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.45) 50%,
                transparent 100%
              );
              transform: translateX(100%);
            }
          }
        `}</style>
      </div>

      <Top10Modal
        open={showTop10}
        onClose={() => setShowTop10(false)}
        label={label}
        rows={rows.slice(0, 10)}
        players={players}
      />
    </>
  );
}

/* ----------------------------------------------------------------------------
   Ticker (no links)
---------------------------------------------------------------------------- */

function Ticker({ rows, players, height = 40, speed = 48 }) {
  const items = useMemo(() => {
    if (!rows.length) return [];
    const top = Math.max(1, ...rows.map((r) => Number(r.effort_score) || 0));
    return rows.map((r, i) => {
      const p = players[r.player_id] || {};
      const name = resolveName(p, r);
      const pct = Math.round(((Number(r.effort_score) || 0) / top) * 100);
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      const points = r.points ?? 0;
      return { medal, name, pct, points, p, r };
    });
  }, [rows, players]);

  const stream = useMemo(() => (items.length ? [...items, ...items] : []), [items]);

  const laneRef = useRef(null);
  const [duration, setDuration] = useState(60);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    const totalPx = Array.from(lane.children).reduce(
      (sum, el) => sum + el.getBoundingClientRect().width,
      0
    );
    const secs = Math.max(10, Math.round(totalPx / Math.max(10, speed)));
    setDuration(secs);
  }, [stream, speed]);

  return (
    <div
      className="relative z-[70] select-none border-y border-white/10 bg-black/40 backdrop-blur rounded-lg pointer-events-auto"
      style={{ height }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/60 to-transparent" />

      <div className="absolute inset-0 overflow-hidden px-3">
        {stream.length ? (
          <div
            ref={laneRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "28px",
              paddingRight: "28px",
              height: "100%",
              willChange: "transform",
              animation: `ticker ${duration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {stream.map((it, idx) => (
              <div
                key={`${idx}-${it.name}-${it.r.player_id}`}
                className="shrink-0 flex items-center gap-4 px-1.5 py-0.5 text-white/95 cursor-default select-none"
                title={`Top ${idx + 1}: ${it.name}`}
              >
                <span className="text-[16px]">{it.medal}</span>
                <Avatar
                  src={resolveAvatar(it.p, it.r)}
                  size={32}
                  ringClass="ring-cyan-300/40"
                />
                <span className="text-[14px] font-semibold leading-none">{it.name}</span>
                <span className="text-[12px] rounded-full border border-white/15 bg-white/10 px-2 py-0.5 leading-none">
                  Effort {it.pct}% · Pts {it.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center px-4 text-[13px] text-white/75">
            No weekly data
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Top 10 Modal — strong blur + neon tiles (no links)
---------------------------------------------------------------------------- */

function Top10Modal({ open, onClose, label, rows, players }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const topScore = Math.max(1, ...rows.map((r) => Number(r.effort_score) || 0));

  return createPortal(
    <div className="fixed inset-0 z-[999]">
      {/* DARK SCRIM + ALWAYS-ON BACKDROP BLUR (inline for reliability) */}
      <div
        className="absolute inset-0 z-0"
        onClick={onClose}
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.48), rgba(0,0,0,0.48))",
          backdropFilter: "blur(12px) saturate(110%)",
          WebkitBackdropFilter: "blur(12px) saturate(110%)",
        }}
      />

      {/* Dialog */}
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.985, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 mx-auto mt-[8vh] w-[95vw] max-w-6xl rounded-3xl border border-white/12 bg-[#0b0f1a]/88 p-6 pt-8 text-white ring-1 ring-white/10 shadow-[0_40px_140px_rgba(0,0,0,.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="text-[22px] font-semibold tracking-wide text-cyan-300">
            {(label || "Weekly Effort")} — Top 10
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[14px] hover:bg-white/20"
          >
            Close
          </button>
        </div>

        {/* Tiles */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.06 } },
          }}
        >
          {rows.map((r, idx) => {
            const p = players[r.player_id] || {};
            const name = resolveName(p, r);
            const pct = Math.round(((Number(r.effort_score) || 0) / topScore) * 100);
            const rank = idx + 1;

            const avatarSize =
              rank === 1 ? 92 : rank === 2 ? 80 : rank === 3 ? 72 : 62;
            const ringClass =
              rank === 1
                ? "ring-amber-300/90"
                : rank === 2
                ? "ring-slate-200/90"
                : rank === 3
                ? "ring-orange-400/90"
                : "ring-cyan-300/60";

            const medal =
              rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

            return (
              <motion.div
                key={`${r.player_id}-${r.week_start}`}
                variants={{
                  hidden: { opacity: 0, y: 12, scale: 0.985 },
                  show: { opacity: 1, y: 0, scale: 1 },
                }}
                className="group relative cursor-default select-none"
              >
                {/* ambient glow */}
                <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br from-cyan-400/30 via-emerald-400/20 to-fuchsia-400/30 opacity-0 blur-2xl transition duration-300 group-hover:opacity-100" />

                {/* spinning neon border (conic) */}
                <div className="relative rounded-2xl p-[2px] bg-[conic-gradient(from_0deg,rgba(56,189,248,.85),rgba(16,185,129,.7),rgba(217,70,239,.9),rgba(56,189,248,.85))] animate-[conic_12s_linear_infinite] shadow-[0_18px_60px_rgba(0,0,0,.55)]">
                  {/* inner glass */}
                  <div className="relative rounded-2xl bg-white/[.16] backdrop-blur-xl px-3.5 py-3.5 ring-1 ring-white/10 transition-[background,transform] group-hover:bg-white/[.24] group-hover:scale-[1.02]">
                    <div className="flex items-center justify-between">
                      <span className="text-[18px]">{medal}</span>
                      <span className="text-[12px] rounded-full border border-white/20 bg-black/40 px-2 py-0.5">
                        Pts {r.points ?? 0}
                      </span>
                    </div>

                    {/* avatar + name with aura */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-[-8px] rounded-full opacity-60 blur-[10px] bg-[conic-gradient(from_0deg,rgba(56,189,248,.55),rgba(16,185,129,.4),rgba(217,70,239,.6),rgba(56,189,248,.55))] animate-[conic_8s_linear_infinite]" />
                        <div className="pointer-events-none absolute inset-[-3px] rounded-full bg-white/25 blur-[4px]" />
                        <Avatar
                          src={resolveAvatar(p, r)}
                          size={avatarSize}
                          ringClass={ringClass}
                          title={name}
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`truncate ${
                            rank <= 3 ? "text-[16px]" : "text-[15px]"
                          } font-semibold leading-tight`}
                        >
                          {name}
                        </div>
                        <div className="text-[11px] text-white/70 leading-tight uppercase">
                          {p?.effort_tier || r?.effort_tier || "—"}
                        </div>
                      </div>
                    </div>

                    {/* stats */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-white/85">
                      <div className="rounded-md bg-white/10 px-2 py-1">
                        <div className="text-[10px] text-white/60">Effort</div>
                        <div className="font-semibold">{r.effort_score ?? 0}</div>
                      </div>
                      <div className="rounded-md bg-white/10 px-2 py-1">
                        <div className="text-[10px] text-white/60">Time</div>
                        <div className="font-semibold">{formatTime(r.minutes)}</div>
                      </div>
                      <div className="rounded-md bg-white/10 px-2 py-1">
                        <div className="text-[10px] text-white/60">Points</div>
                        <div className="font-semibold">{r.points ?? 0}</div>
                      </div>
                    </div>

                    {/* progress */}
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-fuchsia-400"
                          style={{ width: `${pct}%` }}
                          title={`${pct}% of #1`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <style jsx>{`
          @keyframes conic {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </motion.div>
    </div>,
    document.body
  );
}
