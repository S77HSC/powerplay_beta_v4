// app/launch/LaunchClient.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Ensure this file exists at: public/sounds/powerplay_legends.mp3 (all lowercase)
const STING = "/sounds/powerplay_legends.mp3";
const CREST = "/powerplay-logo.png";
const FIST  = "/assets/image.png";

const HARD_FALLBACK_MS = 12000; // final safety timeout if audio never loads

export default function LaunchClient() {
  const router = useRouter();
  const params = useSearchParams();

  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(performance.now());
  const expectedMsRef = useRef(15000); // used for soft progress when duration unknown
  const prevProgressRef = useRef(0);

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Lighting the crest…");

  // Monotonic progress: never decreases
  useEffect(() => {
    const el = audioRef.current;

    const tick = () => {
      const elapsed = performance.now() - startRef.current;

      // Soft time-based progress up to 98%
      const softPct = Math.min(98, (elapsed / Math.max(500, expectedMsRef.current)) * 98);

      // Audio-derived progress if we have duration
      let audioPct = 0;
      if (el && isFinite(el.duration) && el.duration > 0) {
        audioPct = Math.min(98, (el.currentTime / el.duration) * 98);
      }

      const candidate = Math.max(softPct, audioPct, prevProgressRef.current);
      const nextPct = Math.min(99, candidate); // leave headroom for final snap

      if (nextPct > prevProgressRef.current) {
        prevProgressRef.current = nextPct;
        setProgress(nextPct);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    let watchdog;
    let endSnap;

    const next =
      params.get("next") ||
      (typeof window !== "undefined" ? sessionStorage.getItem("nextAfterLogin") : null) ||
      "/lobby";

    const el = audioRef.current;
    if (!el) return;

    const goLobby = () => {
      // Snap to 100, update status, and route
      prevProgressRef.current = 100;
      setProgress(100);
      setStatus("Entering lobby…");
      router.replace(next);
    };

    const onLoadedMeta = () => {
      if (isFinite(el.duration) && el.duration > 0) {
        expectedMsRef.current = el.duration * 1000;
      }
    };

    const onEnded = () => {
      // guard against double-calls
      if (endSnap) return;
      endSnap = setTimeout(goLobby, 150);
    };

    const onError = () => {
      // File missing or blocked; proceed on a short delay
      setStatus("Skipping intro…");
      if (!watchdog) watchdog = setTimeout(goLobby, 800);
    };

    el.addEventListener("loadedmetadata", onLoadedMeta, { once: true });
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    const startPlayback = async () => {
      setStatus("Preparing audio…");

      // HARD FALLBACK: guarantee we leave this screen even if nothing loads
      watchdog = setTimeout(goLobby, HARD_FALLBACK_MS);

      try {
        // try audible
        el.muted = false;
        el.currentTime = 0;
        await el.play();
        setStatus("Intro playing…");
      } catch {
        // fall back to muted (policy-compliant, no prompt)
        try {
          el.muted = true;
          el.currentTime = 0;
          await el.play();
          setStatus("Intro playing…");
        } catch (e) {
          // can't play at all (404 or blocked) -> quick exit
          onError();
          return;
        }
      }

      // If metadata already known, arm a precise watchdog; otherwise wait for it
      const arm = () => {
        const ms =
          isFinite(el.duration) && el.duration > 0
            ? el.duration * 1000 + 250
            : HARD_FALLBACK_MS;
        // Clear the earlier hard fallback, replace with duration-based
        clearTimeout(watchdog);
        watchdog = setTimeout(goLobby, ms);
      };

      if (el.readyState >= 1) arm();
      else el.addEventListener("loadedmetadata", arm, { once: true });
    };

    const delay = setTimeout(startPlayback, 1000);

    return () => {
      clearTimeout(delay);
      clearTimeout(watchdog);
      clearTimeout(endSnap);
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload key images to avoid any flash
  useEffect(() => {
    const crest = new Image();
    crest.src = CREST;
    const fist = new Image();
    fist.src = FIST;
  }, []);

  return (
    <div
      className="absolute inset-0 grid place-items-center bg-neutral-950"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 35%, rgba(8,47,73,0.35), rgba(2,6,23,1) 60%)",
      }}
    >
      {/* Crest */}
      <div className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 z-40">
        <div className="relative inline-block">
          <img
            src={CREST}
            alt="PowerPlay"
            className="h-28 w-auto"
            style={{
              filter: "drop-shadow(0 10px 36px rgba(56,189,248,.35))",
              animation: "pp-breath 2.6s ease-in-out infinite",
            }}
            draggable={false}
            fetchPriority="high"
          />
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <span
              className="absolute top-0 left-[-30%] h-full w-[30%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent)",
                filter: "blur(6px)",
                animation: "pp-glint 2100ms ease-in-out 300ms both",
              }}
            />
          </span>
        </div>
      </div>

      {/* Watermark */}
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
        <div
          style={{
            width: "clamp(420px, 78vw, 820px)",
            opacity: 0.34,
            animation: "pp-watermark 3.6s ease-in-out infinite",
          }}
        >
          <div className="relative">
            <img src={FIST} alt="" className="h-auto w-full" draggable={false} />
          </div>
        </div>
      </div>

      {/* Progress + status */}
      <div className="relative z-20 grid place-items-center gap-3 mt-[18vh]">
        <div className="h-2 w-[min(72vw,360px)] overflow-hidden rounded-full border border-white/15 bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-200 transition-[width] duration-150"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="text-xs text-white/80 tabular-nums">{Math.round(progress)}%</div>
        <div className="text-sm tracking-wider opacity-90">{status}</div>
      </div>

      {/* Audio element */}
      <audio ref={audioRef} src={STING} preload="auto" playsInline />

      <style jsx global>{`
        @keyframes pp-glint {
          0% { transform: translateX(0) skewX(-12deg); opacity: 0; }
          15% { opacity: .9; }
          100% { transform: translateX(350%) skewX(-12deg); opacity: 0; }
        }
        @keyframes pp-breath {
          0%   { transform: scale(1);   filter: drop-shadow(0 10px 36px rgba(56,189,248,.35)); }
          50%  { transform: scale(1.02); filter: drop-shadow(0 16px 46px rgba(56,189,248,.45)); }
          100% { transform: scale(1);   filter: drop-shadow(0 10px 36px rgba(56,189,248,.35)); }
        }
        @keyframes pp-watermark {
          0%{transform:scale(1); opacity:.28}
          50%{transform:scale(1.04); opacity:.38}
          100%{transform:scale(1); opacity:.28}
        }
      `}</style>
    </div>
  );
}
