// lobbycomponents/RewardRevealModal.jsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";

export default function RewardRevealModal({
  open,
  title = "Reward",
  cards = [],
  dust = 0,
  onClose,
}) {
  const [phase, setPhase] = useState("intro"); // intro -> hero -> grid
  const [skipAll, setSkipAll] = useState(false);

  // --- NEW: one-shot audio helper + play-once flags ---
  const played = useRef({ hero: false });
  function playOneShot(url, volume = 0.95) {
    try {
      const a = new Audio(url);
      a.volume = volume;
      a.play().catch(() => {}); // ignore autoplay/gesture blocks
    } catch {}
  }

  // Choose the rarest card as the hero
  const main = useMemo(() => {
    if (!cards?.length) return null;
    const score = { legendary: 3, epic: 2, rare: 1, common: 0 };
    return [...cards].sort(
      (a, b) =>
        (score[(b?.rarity || "").toLowerCase()] ?? 0) -
        (score[(a?.rarity || "").toLowerCase()] ?? 0)
    )[0];
  }, [cards]);

  const rarityKey = (main?.rarity || "common").toLowerCase();
  const rarityTheme = {
    legendary: {
      ring: "ring-yellow-400",
      glowFrom: "from-yellow-500/40",
      glowTo: "to-orange-500/20",
      text: "text-yellow-300",
    },
    epic: {
      ring: "ring-fuchsia-500",
      glowFrom: "from-fuchsia-500/30",
      glowTo: "to-purple-600/20",
      text: "text-fuchsia-300",
    },
    rare: {
      ring: "ring-blue-400",
      glowFrom: "from-cyan-400/30",
      glowTo: "to-blue-500/20",
      text: "text-cyan-300",
    },
    common: {
      ring: "ring-slate-400",
      glowFrom: "from-slate-300/20",
      glowTo: "to-slate-500/10",
      text: "text-slate-200",
    },
  }[rarityKey];

  // Optional SFX – safe if files are missing
  const play = (name) => {
    const file = {
      pack: "/sounds/pack_open.mp3",
      whoosh: "/sounds/whoosh.mp3", // kept for reference; not used at hero anymore
      wow: "/sounds/wow.mp3",
    }[name];
    if (!file) return;
    try {
      new Audio(file).play().catch(() => {});
    } catch {}
  };

  // Sequence timing
  useEffect(() => {
    if (!open) return;
    setPhase("intro");
    setSkipAll(false);
    played.current.hero = false; // reset hero sound latch

    const introMs = 1500;
    const heroMs = 2500;

    play("pack");
    const t1 = setTimeout(() => {
      // (Removed: play('whoosh') to avoid clashing with your magical-reveal)
      setPhase("hero");
    }, introMs);
    const t2 = setTimeout(() => {
      play("wow");
      setPhase("grid");
    }, introMs + heroMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  // --- NEW: fire your magical reveal when hero appears (once per open) ---
  useEffect(() => {
    if (open && phase === "hero" && !played.current.hero) {
      played.current.hero = true;
      playOneShot("/sounds/magical-reveal.mp3", 0.95);
    }
  }, [open, phase]);

  // Background zoom (optional wrapper with id="app-root")
  useEffect(() => {
    const root = document.getElementById("app-root");
    if (!root) return;
    if (open) {
      root.style.transition = "transform 300ms ease, filter 300ms ease";
      root.style.transform = "scale(0.985)";
      root.style.filter = "blur(0.5px) saturate(1.05)";
    } else {
      root.style.transform = "";
      root.style.filter = "";
    }
    return () => {
      root.style.transform = "";
      root.style.filter = "";
    };
  }, [open]);

  // Prevent page scroll AND mute clicks under modal while open
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.classList.add("reveal-open");
    return () => {
      document.documentElement.style.overflow = prev;
      document.documentElement.classList.remove("reveal-open");
    };
  }, [open]);

  const onSkip = () => {
    setSkipAll(true);
    setPhase("grid");
  };
  if (!open) return null;

  const Portal = ({ children }) =>
    typeof window === "undefined" ? null : createPortal(children, document.body);

  const getCardImage = (card) =>
    card?.image || (card?.card_id ? `/player-cards/${card.card_id}.png` : null);

  return (
    <Portal>
      {/* Unbeatable stacking + isolate this stacking context */}
      <div
        id="reward-reveal-root"
        className="fixed inset-0 isolate flex items-center justify-center"
        style={{ zIndex: 2147483647 }}
      >
        {/* Dim/blur backdrop (click to close) */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
        />
        {/* Cinematic vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 45%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Confetti during hero/grid */}
        <AnimatePresence>
          {phase !== "intro" && !skipAll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none"
            >
              <Confetti
                numberOfPieces={phase === "hero" ? 140 : 80}
                recycle={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opaque modal panel so lobby highlights can't bleed through */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-[92vw] max-w-3xl overflow-hidden rounded-3xl border border-white/15 text-white shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
        >
          {/* Opaque fill */}
          <div className="absolute inset-0 bg-neutral-900/95" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
            <div className="text-xl font-bold tracking-wide text-white/90">
              {title || "Reward"}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                Skip
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 px-6 py-6">
            {/* Gentle rarity glow */}
            <div
              className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b ${rarityTheme.glowFrom} ${rarityTheme.glowTo}`}
            />

            {/* Intro */}
            <AnimatePresence>
              {phase === "intro" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid place-items-center py-10"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: [0.95, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="text-center"
                  >
                    <div className="mb-2 text-sm uppercase tracking-widest text-white/70">
                      Opening…
                    </div>
                    <div className="text-2xl font-extrabold">Get ready</div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hero */}
            <AnimatePresence>
              {phase === "hero" && main && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center gap-4 py-6"
                >
                  {/* Spotlight */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -z-10 top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-60"
                    style={{
                      background:
                        rarityKey === "legendary"
                          ? "radial-gradient(closest-side, rgba(255,213,0,0.6), rgba(255,213,0,0.05) 70%, transparent 80%)"
                          : rarityKey === "epic"
                          ? "radial-gradient(closest-side, rgba(217,70,239,0.4), rgba(217,70,239,0.05) 70%, transparent 80%)"
                          : "radial-gradient(closest-side, rgba(59,130,246,0.35), rgba(59,130,246,0.05) 70%, transparent 80%)",
                    }}
                  />

                  <motion.div
                    initial={{ rotateY: 90, scale: 0.85, y: 8, opacity: 0.7 }}
                    animate={{
                      rotateY: 0,
                      scale: [1, 1.02, 1],
                      y: [8, 0, -2, 0],
                      opacity: 1,
                    }}
                    transition={{
                      duration: 0.85,
                      times: [0, 0.7, 1],
                      ease: ["easeOut", "easeInOut"],
                    }}
                    className={`relative w-[240px] sm:w-[280px] aspect-[3/4] rounded-2xl ring-4 ${rarityTheme.ring} bg-zinc-900 shadow-[0_0_80px_rgba(255,255,255,0.25)] ${
                      rarityKey === "legendary" ? "shadow-yellow-500/30" : ""
                    }`}
                  >
                    <img
                      src={getCardImage(main) || "/player-cards/placeholder.png"}
                      alt={main?.name || `Card #${main?.card_id ?? ""}`}
                      className="absolute inset-0 h-full w-full rounded-2xl object-contain"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/player-cards/placeholder.png";
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-white/5" />
                  </motion.div>

                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`text-lg font-semibold ${rarityTheme.text}`}
                  >
                    You got a {main?.rarity?.toUpperCase() || "CARD"}
                    {main?.name
                      ? ` — ${main.name}`
                      : main?.card_id
                      ? ` #${main.card_id}`
                      : ""}
                    !
                  </motion.div>
                  {dust > 0 && (
                    <div className="text-sm text-white/70">+{dust} dust</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid / all rewards */}
            <AnimatePresence>
              {phase === "grid" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="mb-3 text-center text-sm uppercase tracking-wider text-white/60">
                    Rewards
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {cards?.map((c, i) => (
                      <motion.div
                        key={`${c.card_id}-${i}`}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.05 * i }}
                        className={`relative w-full aspect-[3/4] rounded-xl ring-2 ${ringFor(
                          c?.rarity
                        )} bg-zinc-900`}
                      >
                        <img
                          src={
                            getCardImage(c) || "/player-cards/placeholder.png"
                          }
                          alt={c?.name || `Card #${c.card_id}`}
                          className="absolute inset-0 h-full w-full rounded-xl object-contain"
                          draggable={false}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/player-cards/placeholder.png";
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-black/10 via-transparent to-black/30" />
                        <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white/90">
                          {(c?.rarity || "common").toUpperCase()}{" "}
                          {c?.name ? `— ${c.name}` : `#${c.card_id}`}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={onClose}
                      className="rounded-full bg-yellow-400 px-6 py-2 font-semibold text-black hover:bg-yellow-300"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}

function ringFor(rarity) {
  switch ((rarity || "").toLowerCase()) {
    case "legendary":
      return "ring-yellow-400";
    case "epic":
      return "ring-fuchsia-500";
    case "rare":
      return "ring-blue-400";
    default:
      return "ring-slate-400";
  }
}
