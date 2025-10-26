"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NeonIconBar from "../../lobbycomponents/NeonIconBar";

// --------- Football-flavoured config (you can move to data/powerpass.config.js later)
const POWERPASS = {
  seasonName: "Neon Derby",
  xpPerLevel: 120, // 120 XP / level → 1,200 XP for 10 levels
  rarityMap: {
    common:    { label: "Training",    class: "bg-white/10 border-white/15 text-white", halo: "before:bg-white/20" },
    uncommon:  { label: "Matchday",    class: "bg-emerald-400/15 border-emerald-300/30 text-emerald-200", halo: "before:bg-emerald-400/25" },
    rare:      { label: "Pro",         class: "bg-blue-400/15 border-blue-300/30 text-blue-200", halo: "before:bg-blue-400/25" },
    epic:      { label: "European",    class: "bg-fuchsia-400/15 border-fuchsia-300/30 text-fuchsia-200", halo: "before:bg-fuchsia-400/25" },
    legendary: { label: "World Class", class: "bg-amber-400/15 border-amber-300/30 text-amber-200", halo: "before:bg-amber-400/25" },
  },
  levels: [
    { level: 1,  name: "Academy Boots",        rarity: "common",    img: "/items/boots_basic.png" },
    { level: 2,  name: "Warm-Up Emote",        rarity: "uncommon",  img: "/items/emote_warmup.png",  premiumOnly: true },
    { level: 3,  name: "Grip Socks",           rarity: "uncommon",  img: "/items/socks_grip.png" },
    { level: 4,  name: "Captain’s Armband",    rarity: "rare",      img: "/items/armband.png",       premiumOnly: true },
    { level: 5,  name: "Matchday Kit",         rarity: "rare",      img: "/items/kit_match.png" },
    { level: 6,  name: "Pro Boots",            rarity: "rare",      img: "/items/boots_pro.png",     premiumOnly: true },
    { level: 7,  name: "European Night Trail", rarity: "epic",      img: "/items/trail_euro.png",    premiumOnly: true },
    { level: 8,  name: "Club Legend Banner",   rarity: "epic",      img: "/items/banner_legend.png" },
    { level: 9,  name: "World Class Ball",     rarity: "legendary", img: "/items/ball_world.png",    premiumOnly: true },
    { level: 10, name: "Ballon d’Or Kit",      rarity: "legendary", img: "/items/kit_ballondor.png", premiumOnly: true },
  ],
};

// --------- Page
export default function PowerPassPage() {
  // Wire these to Supabase later
  const [hasPremium, setHasPremium] = useState(false);
  const seasonXP = 460; // e.g., players.season_xp

  const xpPerLevel = POWERPASS.xpPerLevel;
  const levels = useMemo(() => POWERPASS.levels, []);
  const totalLevels = levels.length;

  const currentLevel = Math.floor(seasonXP / xpPerLevel); // 0-based internal
  const partial = (seasonXP % xpPerLevel) / xpPerLevel;

  return (
    <main className="min-h-screen text-white relative overflow-hidden bg-[#090b14]">
      <Backdrop />

      <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-10 z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <NeonIconBar current="powerpass" size="sm" />
          <div className="flex items-end gap-4">
            <div className="text-right">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-widest uppercase text-cyan-300 arena-glow">
                Power Pass
              </h1>
              <p className="text-white/70 text-sm">
                {POWERPASS.seasonName} • Climb the divisions by earning XP
              </p>
            </div>
            <GlobeBadge />
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Chip label="Season XP">
            <span className="font-semibold text-cyan-300">{seasonXP}</span>
          </Chip>
          <Chip label="Level">
            <span className="font-semibold text-cyan-300">
              {Math.min(currentLevel, totalLevels)}
            </span>
            <span className="opacity-60">/{totalLevels}</span>
          </Chip>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-lg text-xs border ${
                hasPremium ? "bg-amber-400 text-black border-amber-300" : "bg-white/10 border-white/15"
              }`}
            >
              {hasPremium ? "Premium Active" : "Free Track"}
            </span>
            <button
              onClick={() => setHasPremium((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-sm bg-white/10 border border-white/15 hover:bg-white/15"
            >
              Toggle Premium
            </button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-6">
          <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-400 to-fuchsia-500"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(
                  (seasonXP / (totalLevels * xpPerLevel)) * 100,
                  100
                )}%`,
              }}
              transition={{ type: "spring", stiffness: 110, damping: 18 }}
            />
          </div>
          <div className="mt-2 text-xs text-white/60">
            Progress to Level {Math.min(currentLevel + 1, totalLevels)}
            <span className="ml-2 text-white/40">({Math.round(partial * 100)}%)</span>
          </div>
        </div>

        {/* FREE + PREMIUM rails */}
        <div className="mt-8 space-y-8">
          <SeasonRail
            title="Free Track"
            subtitle="Unlocked as you play"
            tone="cyan"
            levels={levels}
            xpPerLevel={xpPerLevel}
            currentLevel={currentLevel}
            partial={partial}
            hasPremium={false}
          />

          <SeasonRail
            title="Premium Track"
            subtitle="Exclusive matchday gear & pro items"
            tone="fuchsia"
            levels={levels}
            xpPerLevel={xpPerLevel}
            currentLevel={currentLevel}
            partial={partial}
            hasPremium={hasPremium}
            premiumRow
          />
        </div>
      </div>
    </main>
  );
}

// --------- Rail (FIFA-style connected horizontal track)
function SeasonRail({
  title,
  subtitle,
  tone = "cyan",
  levels,
  currentLevel,
  partial,
  hasPremium,
  premiumRow = false,
}) {
  const railRef = useRef(null);

  // Auto-center the current node on mount
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll("[data-node='true']");
    const idx = Math.min(Math.max(currentLevel - 1, 0), nodes.length - 1);
    const target = nodes[idx];
    if (target) {
      const center =
        target.offsetLeft -
        el.clientWidth / 2 +
        target.clientWidth / 2;
      el.scrollTo({ left: center, behavior: "smooth" });
    }
  }, [currentLevel]);

  // header tone
  const headerGlow =
    tone === "fuchsia"
      ? "from-fuchsia-500/30"
      : "from-cyan-400/30";

  // fill width along rail (up to current node)
  const fillPercent = Math.min(
    ((Math.max(1, currentLevel) - 1 + partial) / (levels.length - 1)) * 100,
    100
  );

  return (
    <section className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/15 relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -inset-24 rounded-[24px] blur-2xl opacity-60 mix-blend-screen bg-gradient-to-r ${headerGlow} to-transparent`}
      />
      <div className="relative z-[1] mb-4">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-bold tracking-wide2">{title}</h3>
          <p className="text-white/60 text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="relative z-[1]">
        {/* rail lines */}
        <div className="relative">
          <div className="absolute left-0 right-0 top-8 h-[3px] bg-white/10 rounded-full" />
          <motion.div
            className="absolute top-8 h-[3px] bg-gradient-to-r from-cyan-400 to-fuchsia-500 rounded-full"
            style={{ width: `${fillPercent}%` }}
            transition={{ type: "tween", duration: 0.6 }}
          />
        </div>

        {/* horizontal nodes */}
        <div
          ref={railRef}
          className="mt-6 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 subscroll pr-1"
        >
          {levels.map((lv, i) => {
            const isUnlocked = i + 1 <= currentLevel;
            const locked =
              i + 1 > currentLevel ||
              (premiumRow && lv.premiumOnly && !hasPremium);

            return (
              <div
                key={lv.level}
                data-node="true"
                className="shrink-0 snap-center"
              >
                {/* node dot */}
                <div className="relative h-5 flex items-center justify-center mb-2">
                  <div
                    className={[
                      "w-[14px] h-[14px] rounded-full border",
                      isUnlocked
                        ? "bg-cyan-400/90 border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.7)]"
                        : "bg-white/10 border-white/25",
                    ].join(" ")}
                  />
                </div>

                <LevelCard
                  item={lv}
                  locked={locked}
                  current={i + 1 === Math.max(1, Math.min(currentLevel, levels.length))}
                  progress={i + 1 === currentLevel + 1 ? partial : i + 1 < currentLevel + 1 ? 1 : 0}
                  premium={premiumRow}
                  requirePremium={lv.premiumOnly}
                  hasPremium={hasPremium}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --------- Level Card (FIFA tile w/ rarity glow & spotlight)
function LevelCard({ item, locked, current, progress, premium, requirePremium, hasPremium }) {
  const rarity = POWERPASS.rarityMap[item.rarity] || POWERPASS.rarityMap.common;
  const ring = current ? "ring-2 ring-cyan-300" : "ring-1 ring-white/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: 0.02 * (item.level - 1) }}
      className={`relative w-[240px] max-w-[70vw] rounded-xl bg-gradient-to-b from-[#111827]/80 to-black/70 ${ring} border border-white/10 p-3 overflow-hidden`}
    >
      {/* premium / locked badges */}
      <div className="absolute left-2 top-2 flex items-center gap-2 z-10">
        {premium && (
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] border ${
              hasPremium
                ? "bg-amber-400 text-black border-amber-300"
                : "bg-white/10 border-white/15 text-white/90"
            }`}
          >
            Premium
          </span>
        )}
        {locked && (
          <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/10 border border-white/15">
            Locked
          </span>
        )}
      </div>

      {/* art area */}
      <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-white/5 grid place-items-center">
        <img
          src={item.img}
          alt={item.name}
          className="max-h-[70%] max-w-[84%] object-contain drop-shadow"
        />

        {/* rarity halo */}
        <div className={`pointer-events-none absolute -inset-10 rounded-[18px] blur-xl opacity-60 before:content-[''] before:absolute before:-inset-12 before:rounded-[22px] ${rarity.halo}`} />

        {/* spotlight on current tile */}
        <AnimatePresence>
          {current && (
            <motion.div
              key="spot"
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[140%] h-[180px] bg-white/8 blur-2xl rounded-full" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-cyan-400/10 via-transparent to-fuchsia-500/10 mix-blend-screen"
                animate={{ opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* meta */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-white/60">Level {item.level}</div>
          <div className="text-[13px] font-semibold truncate">{item.name}</div>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] border ${rarity.class}`}>
          {rarity.label}
        </span>
      </div>

      {/* CTA */}
      <div className="mt-2 flex items-center gap-2">
        <button
          disabled={locked || (requirePremium && !hasPremium)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition border 
            ${
              locked || (requirePremium && !hasPremium)
                ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                : "bg-amber-400 text-black border-amber-300 hover:brightness-95 shadow-[0_8px_28px_rgba(251,191,36,.35)]"
            }`}
        >
          {locked ? "Locked" : "Claim"}
        </button>
      </div>
    </motion.div>
  );
}

// --------- Small bits
function Chip({ label, children }) {
  return (
    <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-sm">
      <span className="text-white/60 mr-2">{label}:</span>
      {children}
    </div>
  );
}

function Backdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute w-[700px] h-[700px] bg-cyan-500/20 rounded-full blur-3xl -top-40 -left-40 animate-pulse" />
      <div className="absolute w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-3xl bottom-[-120px] right-[-120px] animate-pulse delay-300" />
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <defs>
          <pattern id="dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="1200" height="600" fill="url(#dots)" />
        {[...Array(7)].map((_, i) => (
          <path key={i} d={`M-50 ${100 + i * 70} Q 600 ${60 + i * 90}, 1250 ${100 + i * 70}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

function GlobeBadge() {
  return (
    <div className="relative w-12 h-12 mr-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 blur-md opacity-70" />
      <div className="relative w-full h-full rounded-full bg-black/60 border border-white/20 grid place-items-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-90">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 12h20M12 2c3 3.5 3 16.5 0 20M12 2c-3 3.5-3 16.5 0 20M4 8c2.5 1.5 13.5 1.5 16 0M4 16c2.5-1.5 13.5-1.5 16 0" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  );
}
