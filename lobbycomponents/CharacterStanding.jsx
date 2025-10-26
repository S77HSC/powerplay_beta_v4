"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function CharacterStanding() {
  return (
    <motion.div
      className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-x-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div
        className="relative"
        style={{
          // steady, punchy glow like the version you liked
          filter:
            "drop-shadow(0 0 55px rgba(255,170,0,0.75)) drop-shadow(0 0 110px rgba(255,90,0,0.55))",
        }}
      >
        <Image
          src="/characters/striker_base.png"
          alt="Player Character"
          width={450}
          height={700}
          priority
          className="object-contain"
        />
      </div>
    </motion.div>
  );
}
