"use client";

import { Orbitron } from "next/font/google";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { useMemo } from "react";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function Lobby() {
  // --- Demo XP ---
  const currentXP = 890;
  const nextXP = 1350;
  const xpPct = Math.min(100, Math.round((currentXP / nextXP) * 100));

  // --- Random size presets for cards ---
  const VARIANTS = [
    { w: "w-72", minH: "min-h-36", pad: "p-5" }, // 18rem
    { w: "w-80", minH: "min-h-44", pad: "p-6" }, // 20rem
    { w: "w-96", minH: "min-h-52", pad: "p-7" }, // 24rem
  ];
  const pick = () => VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  const { dailyV, unlockV, trainingV, statsV } = useMemo(
    () => ({
      dailyV: pick(),
      unlockV: pick(),
      trainingV: pick(),
      statsV: pick(),
    }),
    []
  );

  const cardBase =
    "rounded-xl bg-black/70 text-white shadow-[0_0_15px_rgba(255,215,0,0.6)]";

  // --- Background Parallax (mouse) + springs ---
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const parallaxX = useSpring(mvX, { stiffness: 50, damping: 20, mass: 0.6 });
  const parallaxY = useSpring(mvY, { stiffness: 50, damping: 20, mass: 0.6 });

  // Derived/slower parallax for fog layers
  const fogX = useTransform(parallaxX, (v) => v * 0.5);
  const fogY = useTransform(parallaxY, (v) => v * 0.2);

  const handleMouseMove = (e) => {
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 20; // ~±10px
    const y = (e.clientY / innerHeight - 0.5) * 14; // ~±7px
    mvX.set(x);
    mvY.set(y);
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* ===== LIVING BACKGROUND LAYERS ===== */}

      {/* Base stadium with parallax + slow Ken Burns */}
      <motion.div
        className="absolute -inset-10 z-0"
        style={{
          x: parallaxX,
          y: parallaxY,
          backgroundImage: "url('/images/futuristic-stadium.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.05) brightness(0.95)",
        }}
        animate={{ scale: [1.05, 1.0, 1.05] }}
        transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Sky glow (aurora-style) */}
      <motion.div
        className="pointer-events-none absolute top-0 left-0 right-0 z-[1] h-1/2"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(90,140,255,0.28), rgba(30,60,120,0.15) 50%, transparent 70%)",
          mixBlendMode: "screen",
          filter: "blur(2px)",
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Cloud band A (broad, slow drift) */}
      <motion.div
        className="pointer-events-none absolute top-10 left-[-30%] z-[3] h-40 w-[160%] rounded-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
          filter: "blur(18px)",
          mixBlendMode: "screen",
        }}
        initial={{ x: "-8%" }}
        animate={{ x: "8%" }}
        transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Cloud band B (higher, different speed) */}
      <motion.div
        className="pointer-events-none absolute top-24 left-[-25%] z-[3] h-28 w-[150%] rounded-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
          filter: "blur(14px)",
          mixBlendMode: "screen",
        }}
        initial={{ x: "10%" }}
        animate={{ x: "-10%" }}
        transition={{ duration: 40, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Light sweep across the pitch */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
          mixBlendMode: "screen",
        }}
        initial={{ x: "-60%" }}
        animate={{ x: "160%" }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
      />

      {/* Corner floodlight glows */}
      <motion.div
        className="pointer-events-none absolute -top-24 -left-24 z-[2] h-96 w-96 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(120,180,255,0.22), transparent 70%)",
          filter: "blur(18px)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -top-24 -right-24 z-[2] h-96 w-96 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(120,180,255,0.22), transparent 70%)",
          filter: "blur(18px)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Low rolling fog layer — back */}
      <motion.div
        className="pointer-events-none absolute bottom-0 left-[-20%] z-[4] h-40 w-[140%]"
        style={{
          x: fogX,
          y: fogY,
          background:
            "radial-gradient(120% 60% at 50% 100%, rgba(255,255,255,0.22), rgba(255,255,255,0.08) 45%, transparent 70%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 12, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Low rolling fog layer — front (slightly different speed/shape) */}
      <motion.div
        className="pointer-events-none absolute bottom-0 left-[-15%] z-[4] h-32 w-[130%]"
        style={{
          x: useTransform(parallaxX, (v) => v * 0.3),
          y: useTransform(parallaxY, (v) => v * 0.1),
          background:
            "radial-gradient(120% 60% at 50% 100%, rgba(255,255,255,0.16), rgba(255,255,255,0.06) 45%, transparent 70%)",
          filter: "blur(12px)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
      />

      {/* ===== FOREGROUND UI ===== */}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-black/40 p-4">
        <div className="flex gap-4 text-2xl text-white">🏠 🏆 👤 ⚙️</div>
        <div className={`${orbitron.className} text-white text-lg`}>Player</div>
      </div>

      {/* Avatar + Player Info */}
      <motion.div
        className="absolute inset-x-0 top-28 z-20 flex flex-col items-center text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div className="relative mb-4">
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow: [
                "0 0 35px #ff6a00, 0 0 80px #ff0000",
                "0 0 60px #ffaa00, 0 0 120px #ff4500",
                "0 0 40px #ff6a00, 0 0 100px #ff0000",
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
          <div className="h-40 w-40 rounded-full border-4 border-yellow-400 bg-gray-700" />
        </motion.div>

        <h2 className={`${orbitron.className} text-3xl text-white drop-shadow-[0_0_8px_#00f6ff]`}>
          Player
        </h2>
        <p className="text-green-400">Not Ready</p>

        <div className="mt-2 h-3 w-64 overflow-hidden rounded-full bg-gray-700">
          <motion.div
            className="h-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_12px_#FFD700]"
            initial={{ width: 0 }}
            animate={{ width: `${xpPct}%` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </div>
        <p className="mt-1 text-sm text-white">
          {currentXP} / {nextXP} XP
        </p>
      </motion.div>

      {/* Character with fiery aura (nudged ~1cm right) */}
      <motion.div
        className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-x-10"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <motion.div
          className="relative"
          animate={{
            filter: [
              "drop-shadow(0 0 50px rgba(255,120,0,0.8)) drop-shadow(0 0 100px rgba(255,60,0,0.7))",
              "drop-shadow(0 0 70px rgba(255,170,0,1)) drop-shadow(0 0 130px rgba(255,80,0,0.9))",
              "drop-shadow(0 0 50px rgba(255,120,0,0.8)) drop-shadow(0 0 100px rgba(255,60,0,0.7))",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/characters/striker_base.png"
            alt="Player Character"
            width={450}
            height={700}
            priority
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      {/* LEFT COLUMN — random sizes */}
      <div className="absolute left-8 bottom-8 z-20 flex w-fit flex-col gap-6">
        {/* Daily Skill Challenge */}
        <motion.div
          className={`${cardBase} border border-purple-500 shadow-[0_0_15px_#9d4edd] ${dailyV.w} ${dailyV.minH} ${dailyV.pad}`}
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <h3 className={`${orbitron.className} mb-2 text-lg drop-shadow-[0_0_6px_#9d4edd]`}>
            DAILY SKILL CHALLENGE
          </h3>
          <p className="text-sm text-gray-300">🔥 Complete today’s drill to earn bonus XP.</p>
          <button
            className={`${orbitron.className} mt-4 rounded-lg bg-purple-500 px-6 py-2 text-lg font-bold text-black shadow-[0_0_12px_#9d4edd] transition hover:scale-105`}
          >
            START CHALLENGE
          </button>
        </motion.div>

        {/* Next Unlock (with video) */}
        <motion.div
          className={`${cardBase} border border-blue-400 shadow-[0_0_18px_#00f6ff] ${unlockV.w} ${unlockV.minH} ${unlockV.pad}`}
          initial={{ x: -220, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
        >
          <h3 className={`${orbitron.className} mb-2 text-lg drop-shadow-[0_0_6px_#00f6ff]`}>
            NEXT UNLOCK
          </h3>
          <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg border border-blue-400 shadow-[0_0_12px_#00f6ff]">
            <video
              src="/videos/example_1.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-sm text-gray-300">⏱️ Skill: Tick-Tock Outside-In</p>
          <p className="mt-1 text-sm text-blue-400">Unlocks at Level 13</p>
        </motion.div>

        {/* Training Mode */}
        <motion.div
          className={`${cardBase} shadow-[0_0_15px_#FFD700] ${trainingV.w} ${trainingV.minH} ${trainingV.pad}`}
          initial={{ x: -240, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
        >
          <h3 className={`${orbitron.className} mb-2 text-lg drop-shadow-[0_0_6px_#FFD700]`}>
            TRAINING MODE
          </h3>
          <p className="text-sm text-gray-300">Ranked: Solo</p>
          <button
            className={`${orbitron.className} mt-4 rounded-lg bg-yellow-400 px-10 py-3 text-xl font-bold text-black shadow-[0_0_12px_#FFD700] transition hover:scale-105`}
          >
            PLAY
          </button>
        </motion.div>
      </div>

      {/* RIGHT — Stats (random size) */}
      <motion.div
        className={`absolute right-8 bottom-8 z-20 border border-yellow-400 bg-gradient-to-br from-gray-900/90 to-black/90 shadow-[0_0_20px_#FFD700] ${statsV.w} ${statsV.minH} ${statsV.pad}`}
        initial={{ x: 200, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
      >
        <h3 className={`${orbitron.className} mb-3 text-2xl text-yellow-400`}>Stats</h3>
        <ul className="space-y-2 text-lg text-white">
          <li>⭐ <span className="font-bold text-yellow-400">Level 12</span></li>
          <li>🏆 <span className="font-bold text-green-400">Wins: 2</span></li>
          <li>🥅 <span className="font-bold text-pink-400">Goals: 2</span></li>
          <li>📊 <span className="font-bold text-blue-400">Sessions: 366</span></li>
        </ul>
      </motion.div>
    </div>
  );
}
