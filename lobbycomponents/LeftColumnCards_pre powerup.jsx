"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export default function LeftColumnCards({ orbitronClass }) {
  // Random size presets (stable per mount)
  const VARIANTS = [
    { w: "w-72", pad: "p-5" },
    { w: "w-80", pad: "p-6" },
    { w: "w-96", pad: "p-7" },
  ];
  const pick = () => VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  const { dailyV, unlockV, trainingV } = useMemo(
    () => ({ dailyV: pick(), unlockV: pick(), trainingV: pick() }),
    []
  );

  const cardBase =
    "rounded-xl bg-black/70 text-white shadow-[0_0_15px_rgba(255,215,0,0.6)]";

  // Tabs + auto-rotate
  const TABS = ["skills", "equip", "card"];
  const [tab, setTab] = useState("skills");
  const [paused, setPaused] = useState(false);

  // ---------- Video handling (robust) ----------
  // Put the file(s) in /public/videos/
  const videoCandidates = useMemo(
    () => [
      "/videos/example_1.mp4",
      "/videos/example_1.webm",
      "/videos/example_1.mov",
    ],
    []
  );
  const [srcIdx, setSrcIdx] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef(null);

  // Auto-rotate every 5s (pause on hover)
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTab((curr) => TABS[(TABS.indexOf(curr) + 1) % TABS.length]);
    }, 5000);
    return () => clearInterval(id);
  }, [paused]);

  // Reset video when switching back to "skills"
  useEffect(() => {
    if (tab !== "skills") return;
    setVideoFailed(false);
    setSrcIdx(0);
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    } catch {}
  }, [tab]);

  const handleVideoError = () => {
    // Try next candidate; if none left, show fallback
    setSrcIdx((i) => {
      const next = i + 1;
      if (next >= videoCandidates.length) {
        setVideoFailed(true);
        return i;
      }
      return next;
    });
  };

  const contentAnim = {
    initial: { opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: -10, scale: 0.98, filter: "blur(6px)" },
    transition: { duration: 0.35, ease: "easeOut" },
  };

  return (
    <div className="flex w-fit flex-col gap-6">
      {/* Daily Skill Challenge */}
      <motion.div
        className={`${cardBase} border border-purple-500 shadow-[0_0_15px_#9d4edd] ${dailyV.w} ${dailyV.pad}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <h3 className={`${orbitronClass} mb-2 text-lg drop-shadow-[0_0_6px_#9d4edd]`}>
          DAILY SKILL CHALLENGE
        </h3>
        <p className="text-sm text-gray-300">
          🔥 Complete today’s drill to earn bonus XP.
        </p>
        <button
          className={`${orbitronClass} mt-4 rounded-lg bg-purple-500 px-6 py-2 text-lg font-bold text-black shadow-[0_0_12px_#9d4edd] transition hover:scale-105`}
        >
          START CHALLENGE
        </button>
      </motion.div>

      {/* Next Unlocks — auto-rotating with flashy transitions */}
      <motion.div
        className={`${cardBase} relative overflow-hidden border border-blue-400 shadow-[0_0_18px_#00f6ff] ${unlockV.w} ${unlockV.pad} min-h-[16rem]`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className={`${orbitronClass} text-lg drop-shadow-[0_0_6px_#00f6ff]`}>
            NEXT UNLOCKS
          </h3>

          <div className="flex overflow-hidden rounded-md border border-white/10 text-xs">
            {[
              { id: "skills", label: "Skills" },
              { id: "equip", label: "Equipment" },
              { id: "card", label: "Card" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-2 py-1 transition ${
                  tab === t.id
                    ? "bg-white/15 text-white"
                    : "bg-transparent text-white/70 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* burst flash */}
        <AnimatePresence>
          <motion.div
            key={`burst-${tab}`}
            className="pointer-events-none absolute inset-0 rounded-xl"
            initial={{ opacity: 0.65, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              boxShadow:
                "0 0 0 2px rgba(0,246,255,0.6), 0 0 40px rgba(0,246,255,0.8), inset 0 0 40px rgba(0,246,255,0.15)",
            }}
          />
        </AnimatePresence>

        {/* CONTENT */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div key={tab} {...contentAnim}>
              {tab === "skills" && (
                <>
                  {/* VIDEO with fallbacks */}
                  {!videoFailed ? (
                    <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg border border-blue-400 shadow-[0_0_12px_#00f6ff]">
                      <video
                        key={videoCandidates[srcIdx]}        // re-mount when src changes
                        ref={videoRef}
                        src={videoCandidates[srcIdx]}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onError={handleVideoError}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative mb-3 flex h-40 w-full items-center justify-center rounded-lg border border-blue-400 bg-white/5 text-sm text-white/70">
                      Preview unavailable
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">⏱️ Tick-Tock Outside-In</span>
                    <span className="text-blue-300">Unlocks at Level 13</span>
                  </div>
                </>
              )}

              {tab === "equip" && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { emoji: "👟", name: "Pro Boots", req: "Lv 14" },
                    { emoji: "🧤", name: "Grip Gloves", req: "Lv 15" },
                    { emoji: "🎯", name: "Aim Band", req: "Coins 1200" },
                  ].map((it) => (
                    <div
                      key={it.name}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 text-center"
                    >
                      <div className="text-2xl">{it.emoji}</div>
                      <div className="mt-1 text-xs text-white">{it.name}</div>
                      <div className="text-[10px] text-white/60">{it.req}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "card" && (
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-yellow-300 to-orange-500 p-[2px]">
                    <div className="flex h-28 w-20 items-center justify-center rounded-[10px] bg-black/85">
                      <img
                        src="/Player%20Cards/d_beckman_legendary.png"
                        alt="Next Card"
                        className="h-24 w-16 object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className={`${orbitronClass} text-sm`}>
                      Legendary Card: <span className="text-yellow-300">D. Beckman</span>
                    </div>
                    <div className="text-xs text-white/70">
                      Event: Weekend Cup • Available soon
                    </div>
                    <button className="mt-2 rounded-md bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20">
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* sheen sweep */}
        <motion.div
          key={`sheen-${tab}`}
          className="pointer-events-none absolute inset-y-3 -left-20 -right-20 rounded-xl"
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            background:
              "linear-gradient(110deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 60%)",
            mixBlendMode: "screen",
          }}
        />
      </motion.div>

      {/* Training Mode */}
      <motion.div
        className={`${cardBase} shadow-[0_0_15px_#FFD700] ${trainingV.w} ${trainingV.pad}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <h3 className={`${orbitronClass} mb-2 text-lg drop-shadow-[0_0_6px_#FFD700]`}>
          TRAINING MODE
        </h3>
        <p className="text-sm text-gray-300">Ranked: Solo</p>
        <button
          className={`${orbitronClass} mt-4 rounded-lg bg-yellow-400 px-10 py-3 text-xl font-bold text-black shadow-[0_0_12px_#FFD700] transition hover:scale-105`}
        >
          PLAY
        </button>
      </motion.div>
    </div>
  );
}
