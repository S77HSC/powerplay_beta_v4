"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { supabase } from "../../lib/supabase"; // <-- updated

/* ===== fixed stage size (autoscaled) ===== */
const BASE_W = 1440;
const BASE_H = 900;

/* ===== layout knobs ===== */
const LAYOUT = {
  HEADER_TOP: 86,

  RAIL_W: 340,
  RAIL_SCALE: 0.95,
  RAIL_BOTTOM: 22,
  GUTTER: 28,

  CTA_WIDTH: 780,
  CTA_BOTTOM: 18,
  CTA_H: 56,

  TRAY_H: 208,
  TRAY_GAP_ABOVE_CTA: 16,
  CENTER_GAP: 16,
};

/* ===== lazy components (../../) ===== */
const EventBanners      = dynamic(() => import("../../lobbycomponents/EventBanners"),      { ssr: false });
const CharacterStanding = dynamic(() => import("../../lobbycomponents/CharacterStanding"), { ssr: false });
const LeftColumnCards   = dynamic(() => import("../../lobbycomponents/LeftColumnCards"),   { ssr: false });
const StatsCard         = dynamic(() => import("../../lobbycomponents/StatsCard"),         { ssr: false });
const CollectiblesTray  = dynamic(() => import("../../lobbycomponents/CollectiblesTray"),  { ssr: false });
const PlayerCardTile    = dynamic(() => import("../../lobbycomponents/PlayerCardTile"),    { ssr: false });
const NeonIconBar       = dynamic(() => import("../../lobbycomponents/NeonIconBar"),       { ssr: false });
const RewardCenter      = dynamic(() => import("../../lobbycomponents/RewardCentre"),      { ssr: false });
const StreakPill        = dynamic(() => import("../../lobbycomponents/StreakPill"),        { ssr: false });
const FreePickPill      = dynamic(() => import("../../lobbycomponents/FreePickPill"),      { ssr: false });

/* ===== helpers ===== */
const toNumber = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function getAvatarPublicUrl(key) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || key.startsWith("/")) return key;
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars").replace(/^\/*|\/*$/g, "");
  const normalized = String(key).replace(/^\/*/, "").replace(/^avatars\//, "");
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
  return data?.publicUrl || null;
}

/* dynamic viewport for iOS/iPadOS toolbars */
function useViewportLock() {
  useEffect(() => {
    const setVh = () =>
      document.documentElement.style.setProperty("--app-vh", `${window.innerHeight * 0.01}px`);
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);
}

/* compute stage scale + centering — scoped to a wrapper element (Option A) */
function useLocalUiScale(targetRef) {
  useEffect(() => {
    const calc = () => {
      const vv = window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
      const scale = Math.min(vv.width / BASE_W, vv.height / BASE_H);
      const sceneW = BASE_W * scale;
      const sceneH = BASE_H * scale;
      const left = Math.max(0, (vv.width - sceneW) / 2);
      const top = Math.max(0, (vv.height - sceneH) / 2);
      const el = targetRef.current;
      if (!el) return;
      // 💡 Set CSS vars on the wrapper only (no <html> mutations)
      el.style.setProperty("--ui-scale", String(scale));
      el.style.setProperty("--ui-left", `${left}px`);
      el.style.setProperty("--ui-top", `${top}px`);
    };
    calc();
    const onResize = () => calc();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onResize);
      window.visualViewport.addEventListener("scroll", onResize);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
        window.visualViewport.removeEventListener("scroll", onResize);
      }
    };
  }, [targetRef]);
}

/* ===== header mini component ===== */
function BigHeader({ name, avatarUrl, level, points }) {
  const inLevel = toNumber(points, 0) % 100;
  const pct = Math.max(0, Math.min(100, (inLevel / 100) * 100));
  return (
    <div className="flex flex-col items-center text-white select-none">
      <div className="relative rounded-full p-[5px] bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_28px_rgba(255,190,0,0.45)]">
        <div className="overflow-hidden rounded-full bg-slate-700" style={{ width: 110, height: 110 }}>
          <img
            src={avatarUrl || "/characters/striker_base.png"}
            alt="Avatar"
            className="block w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = "/characters/striker_base.png"; }}
          />
        </div>
      </div>
      <div className="mt-3 font-arena tracking-wide3 uppercase leading-none arena-glow text-[26px]">
        {name || "Player"}
      </div>
      <div className="mt-1 font-arena tracking-wide2 text-teal-300/85 uppercase text-[13px]">Level {level}</div>
      <div className="mt-3 w-[640px]">
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%`, transition: "width 600ms ease" }} />
        </div>
        <div className="mt-1 text-center text-xs text-white/70 font-arena tracking-wide2">
          {inLevel} / 100 XP (total: {toNumber(points, 0)})
        </div>
      </div>
    </div>
  );
}

/* ===== page ===== */
export default function Lobby() {
  useViewportLock();

  // ⬇️ scope scaling vars to this wrapper (fixes hydration issues elsewhere)
  const lobbyRef = useRef(null);
  useLocalUiScale(lobbyRef);

  /* lock page scroll ONLY while on this stage */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.classList.add("is-stage");
    document.body.style.overflow = ""; // let the CSS class control overflow
    return () => {
      document.body.classList.remove("is-stage");
      document.body.style.overflow = prev || "";
    };
  }, []);

  // fullscreen support (requires a user gesture)
  const [canFs, setCanFs] = useState(false);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const isPWA =
      (typeof window !== "undefined" &&
        (window.matchMedia?.("(display-mode: standalone)")?.matches ||
         window.navigator?.standalone === true)) || false;
    const supported = !!document.fullscreenEnabled && !isPWA;
    setCanFs(supported);
    setIsFs(!!document.fullscreenElement);
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.debug("Fullscreen request failed:", e);
    }
  };

  // parallax
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const x = useSpring(mvX, { stiffness: 50, damping: 20, mass: 0.6 });
  const y = useSpring(mvY, { stiffness: 50, damping: 20, mass: 0.6 });
  const onMouseMove = useCallback((e) => {
    mvX.set((e.clientX / window.innerWidth - 0.5) * 16);
    mvY.set((e.clientY / window.innerHeight - 0.5) * 10);
  }, [mvX, mvY]);

  // data
  const [loading, setLoading] = useState(true);
  const [playerRow, setPlayerRow] = useState(null);

  const fetchPlayer = useCallback(async () => {
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    const uid = userData?.user?.id;
    if (!uid) { setPlayerRow(null); return; }
    const SEL = "id,name,avatar_url,points,player_status,auth_id,games_won,goals,workouts_completed,last_completed";
    const { data: byAuth } = await supabase.from("players").select(SEL).eq("auth_id", uid).maybeSingle();
    setPlayerRow(byAuth || null);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await fetchPlayer(); } catch { if (alive) setPlayerRow(null); } finally { if (alive) setLoading(false); }
    })();
    const onVis = () => { if (document.visibilityState === "visible") fetchPlayer(); };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", fetchPlayer);
    return () => {
      alive = false;
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", fetchPlayer);
    };
  }, [fetchPlayer]);

  useEffect(() => {
    if (!playerRow?.auth_id) return;
    const ch = supabase
      .channel("players-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `auth_id=eq.${playerRow.auth_id}` },
        (payload) => setPlayerRow((prev) => ({ ...(prev || {}), ...(payload.new || {}) })),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerRow?.auth_id]);

  const computed = useMemo(() => {
    const name = playerRow?.name || "Player";
    const avatarUrl = getAvatarPublicUrl(playerRow?.avatar_url) || "/characters/striker_base.png";
    const points = toNumber(playerRow?.points, 0);
    const level = Math.max(1, Math.floor(points / 100) + 1);
    const stats = {
      level,
      wins: toNumber(playerRow?.games_won, 0),
      goals: toNumber(playerRow?.goals, 0),
      sessions: toNumber(playerRow?.workouts_completed, 0),
    };
    return { name, avatarUrl, points, level, stats };
  }, [playerRow]);

  // center width between rails (for tray)
  const trayCenterWidth = Math.max(
    520,
    BASE_W - 2 * (LAYOUT.GUTTER + LAYOUT.RAIL_W) - 2 * LAYOUT.CENTER_GAP
  );
  const trayBottom = LAYOUT.CTA_BOTTOM + LAYOUT.CTA_H + LAYOUT.TRAY_GAP_ABOVE_CTA;

  return (
    <div
      ref={lobbyRef}
      className="w-screen"
      style={{
        height: "calc(var(--app-vh, 1vh) * 100)",
        overflow: "hidden",
        background: "#000",
        position: "relative",
        /* defaults so there’s no flash before the effect runs */
        "--ui-scale": 1,
        "--ui-left": "0px",
        "--ui-top": "0px",
      }}
      onMouseMove={onMouseMove}
    >
      {/* fixed 1440×900 stage, auto-scaled and centered */}
      <div
        className="relative will-change-transform"
        style={{
          position: "absolute",
          left: "var(--ui-left, 0px)",
          top: "var(--ui-top, 0px)",
          width: `${BASE_W}px`,
          height: `${BASE_H}px`,
          transform: "translateZ(0) scale(var(--ui-scale, 1))",
          transformOrigin: "top left",
        }}
      >
        {/* Background */}
        <motion.div
          initial={false}
          className="absolute inset-0 z-0 will-change-transform pointer-events-none"
          style={{
            x, y,
            backgroundImage: "url('/images/futuristic-stadium.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.03) brightness(0.97)",
          }}
          animate={{ scale: [1.02, 1.0, 1.02] }}
          transition={{ duration: 20, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          initial={false}
          className="pointer-events-none absolute inset-0 z-10 will-change-transform"
          style={{
            background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
            mixBlendMode: "screen",
          }}
          animate={{ x: ["-60%", "160%"] }}
          transition={{ duration: 18, ease: "linear", repeat: Infinity }}
        />

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-black/40 p-3 border-b border-white/10">
          <div className="flex items-center gap-3 max-w-full">
            <div className="neon-icon-bar-container"><NeonIconBar /></div>
            <Link
              href="/live-news"
              aria-label="Open Live News"
              className="ml-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-yellow-400/20 hover:border-yellow-400/60 transition-colors shrink-0"
            >
              News
            </Link>
            {canFs && !isFs && (
              <button
                onClick={enterFullscreen}
                className="ml-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 hover:bg-white/15"
              >
                Fullscreen
              </button>
            )}
          </div>
          <div className="font-arena text-sm tracking-wide2 opacity-80 pr-1">
            {loading ? "Loading…" : playerRow ? "Signed in" : "Not signed in"}
          </div>
        </div>

        {/* Banners */}
        <div className="hidden sm:block"><EventBanners /></div>

        {/* Header */}
        <div className="absolute inset-x-0 z-30 flex flex-col items-center gap-3" style={{ top: LAYOUT.HEADER_TOP }}>
          <BigHeader name={computed.name} avatarUrl={computed.avatarUrl} level={computed.level} points={computed.points} />
          <div className="flex items-center gap-2 mt-2">
            <StreakPill player_id={playerRow?.id} />
            <FreePickPill player_id={playerRow?.id} />
          </div>
          <RewardCenter player_id={playerRow?.id} />
        </div>

        {/* CTA (near foot) */}
        <div
          className="absolute left-1/2 z-40 -translate-x-1/2 px-2"
          style={{ bottom: LAYOUT.CTA_BOTTOM, width: LAYOUT.CTA_WIDTH }}
        >
          <Link
            href="/reaction-rush"
            aria-label="Play Reaction Rush mini game"
            className="group block"
            onClick={() => { if (canFs && !isFs) enterFullscreen(); }}
          >
            <div
              className="relative mx-auto flex items-center justify-between gap-3 rounded-full border border-cyan-300/30 bg-white/5 px-5 py-3 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(56,189,248,0.45)] ring-1 ring-white/10 transition-all duration-300 hover:border-cyan-300/60 hover:shadow-[0_14px_40px_-10px_rgba(56,189,248,0.65)]"
              style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))" }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-300/40 overflow-hidden">
                  <Image src="/reaction-rush/rr-icon.png" alt="Reaction Rush logo" width={24} height={24} className="h-5 w-5 object-contain" priority />
                </span>
                <div>
                  <div className="font-arena tracking-wide2 uppercase text-cyan-300 text-[11px]">Reaction Rush</div>
                  <div className="text-[10px] text-white/80">Build reactions • have fun • earn XP</div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/80">Mini game</span>
                <svg className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </div>
              <span className="pointer-events-none absolute -left-24 top-0 h-full w-1/3 rotate-12 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </Link>
        </div>

        {/* Collectibles tray (centered between rails, above CTA) */}
        <div
          id="bottom-dock"
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            zIndex: 45,
            bottom: trayBottom,
            width: trayCenterWidth,
            height: LAYOUT.TRAY_H,
            overflow: "hidden",
          }}
        >
          <div className="absolute inset-0 px-2">
            <CollectiblesTray player_id={playerRow?.id} orbitronClass="font-arena" />
          </div>
        </div>

        {/* Character behind HUD */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <CharacterStanding />
        </div>

        {/* Left rail — bottom-left anchored */}
        <div
          className="hidden lg:block absolute z-40"
          style={{
            left: LAYOUT.GUTTER,
            bottom: LAYOUT.RAIL_BOTTOM,
            width: LAYOUT.RAIL_W,
            transform: `scale(${LAYOUT.RAIL_SCALE})`,
            transformOrigin: "left bottom",
          }}
        >
          <LeftColumnCards />
        </div>

        {/* Right rail — bottom-right anchored */}
        <div
          className="hidden lg:flex fixed z-40 flex-col gap-6"
          style={{
            right: LAYOUT.GUTTER,
            bottom: LAYOUT.RAIL_BOTTOM,
            width: LAYOUT.RAIL_W,
            transform: `scale(${LAYOUT.RAIL_SCALE})`,
            transformOrigin: "right bottom",
          }}
        >
          <PlayerCardTile mode="auto" persist="button" orbitronClass="font-arena tracking-wide2" />
          <StatsCard stats={computed.stats} orbitronClass="font-arena tracking-wide2" />
        </div>

        {/* Mobile HUD for rails (simple bottom sheet) */}
        <MobileRailsHUD stats={computed.stats} />
      </div>
    </div>
  );
}

/* ===== Mobile bottom sheet to access rails on phones ===== */
function MobileRailsHUD({ stats }) {
  const [dock, setDock] = useState(null); // "left" | "right" | null
  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-[65] pointer-events-none">
      <div className="flex justify-between px-4 pb-2 pointer-events-auto">
        <button
          onClick={() => setDock(dock === "left" ? null : "left")}
          className="rounded-full bg-white/10 text-white px-4 py-2 ring-1 ring-white/15 backdrop-blur hover:bg-white/15"
        >
          Menu
        </button>
        <button
          onClick={() => setDock(dock === "right" ? null : "right")}
          className="rounded-full bg-white/10 text-white px-4 py-2 ring-1 ring-white/15 backdrop-blur hover:bg-white/15"
        >
          Stats
        </button>
      </div>

      <motion.div
        initial={false}
        animate={{ y: dock ? 0 : 260, opacity: dock ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="mx-2 mb-2 pointer-events-auto rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
        style={{ height: 240, overflow: "hidden" }}
      >
        <div className="h-full overflow-y-auto p-3">
          {dock === "left" ? (
            <LeftColumnCards />
          ) : dock === "right" ? (
            <div className="flex flex-col gap-4">
              <PlayerCardTile mode="auto" persist="button" orbitronClass="font-arena tracking-wide2" />
              <StatsCard stats={stats} orbitronClass="font-arena tracking-wide2" />
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
