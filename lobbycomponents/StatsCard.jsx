"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

export default function StatsCard({ orbitronClass }) {
  const VARIANTS = [
    { w: "w-72", minH: "min-h-36", pad: "p-5" },
    { w: "w-80", minH: "min-h-44", pad: "p-6" },
    { w: "w-96", minH: "min-h-52", pad: "p-7" },
  ];
  const pick = () => VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  const size = useMemo(() => pick(), []);

  return (
    <motion.div
      className={`rounded-xl border border-yellow-400 bg-gradient-to-br from-gray-900/90 to-black/90 p-6 text-white shadow-[0_0_20px_#FFD700] ${size.w} ${size.minH} ${size.pad}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
    >
      <h3 className={`${orbitronClass} mb-3 text-2xl text-yellow-400`}>Stats</h3>
      <ul className="space-y-2 text-lg">
        <li>⭐ <span className="font-bold text-yellow-400">Level 12</span></li>
        <li>🏆 <span className="font-bold text-green-400">Wins: 2</span></li>
        <li>🥅 <span className="font-bold text-pink-400">Goals: 2</span></li>
        <li>📊 <span className="font-bold text-blue-400">Sessions: 366</span></li>
      </ul>
    </motion.div>
  );
}
