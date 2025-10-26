// components/SharedStadiumBG.jsx
"use client";

// If you don’t want cache-busting, remove the ?v=...
const STADIUM_IMG = "/images/futuristic-stadium_b.png?v=1";

export default function SharedStadiumBG() {
  return (
    // Use FIXED + z-0 so it never sits behind the body background
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {/* Stadium still */}
      <img
        src={STADIUM_IMG}
        alt=""
        className="h-full w-full object-cover select-none"
        draggable="false"
        decoding="async"
        onError={(e) => {
          // Fallback if the _b filename isn’t present
          e.currentTarget.src = "/images/futuristic-stadium.png";
        }}
      />
      {/* Soft darken for legibility */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(100% 100% at 50% 20%, rgba(0,0,0,0) 40%, rgba(0,0,0,.45) 100%)",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}
