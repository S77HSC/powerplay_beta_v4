// app/launch/page.jsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import LaunchClient from "./LaunchClient";

export const metadata = {
  title: "Launching • PowerPlay",
};

export default function LaunchPage() {
  return (
    <main className="relative min-h-[100svh] w-full text-white">
      <StadiumBG />
      <Suspense fallback={null}>
        <LaunchClient />
      </Suspense>
    </main>
  );
}

/** Shared stadium backdrop (no styled-jsx here) */
function StadiumBG() {
  return (
    <div className="absolute inset-0 -z-10">
      <img
        src="/images/futuristic-stadium_b.png"
        alt=""
        className="h-full w-full object-cover"
        draggable={false}
      />
      {/* gentle vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_65%,rgba(0,0,0,0)_0%,rgba(0,0,0,.55)_60%,rgba(0,0,0,.85)_100%)]" />
      {/* moving pinstripes */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 2px, transparent 2px, transparent 14px)",
          backgroundSize: "140px 140px",
          animation: "stripe-pan 12s linear infinite",
        }}
      />
      {/* define keyframes without styled-jsx */}
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes stripe-pan {
              0% { background-position: 0 0; }
              100% { background-position: 140px 0; }
            }
          `,
        }}
      />
    </div>
  );
}
