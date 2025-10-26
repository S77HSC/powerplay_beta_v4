// components/PlayerProgressChart.jsx
"use client";
import React from "react";

export default function PlayerProgressChart({ value = 0, label = "", color = "#38bdf8" }) {
  const percent = Math.min(value, 100);

  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <path
          className="text-gray-700"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className="text-cyan-400"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${percent}, 100`}
          strokeLinecap="round"
          fill="none"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
        <span className="text-white font-bold">{value}</span>
        <span className="text-gray-400">{label}</span>
      </div>
    </div>
  );
}
