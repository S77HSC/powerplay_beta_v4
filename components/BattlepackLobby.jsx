'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

// Load layered avatar on the client (it uses localStorage/Supabase)
const AvatarLayers = dynamic(() => import('./AvatarLayers'), { ssr: false });
// ^ NOTE: path is relative to THIS file (components/AvatarLayers.jsx)

export default function BattlepackLobby() {
  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center">
      <div className="relative aspect-[16/9] overflow-visible" style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
        {/* Background */}
        <div className="absolute inset-0">
          <img src="/images/futuristic-stadium.png" alt="Futuristic Football Stadium" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Top nav */}
        <div className="absolute left-0 right-0 top-0 h-14 flex items-center gap-6 px-6 text-white font-semibold text-[clamp(12px,1.2vw,16px)]">
          <span className="px-3 py-1 rounded bg-white text-black">PLAY</span>
          <span className="opacity-80">BATTLE PASS</span>
          <Link href="/locker" className="opacity-100 hover:opacity-90">LOCKER</Link>
          <span className="opacity-80">ITEM SHOP</span>
          <span className="opacity-80">CAREER</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded bg-white/15 px-3 py-1 text-[clamp(10px,1.1vw,14px)] font-bold">EUROPE</div>
            <div className="rounded bg-white/15 px-3 py-1 text-[clamp(10px,1.1vw,14px)] font-extrabold">8,550</div>
          </div>
        </div>

        {/* Left HUD */}
        <div className="absolute left-8 top-24 w-[420px] text-white drop-shadow">
          <h3 className="text-sky-100/80 tracking-wide text-[clamp(12px,1.2vw,16px)]">CHAPTER 1</h3>
          <h2 className="font-extrabold leading-none text-[clamp(28px,4vw,64px)]">SEASON 1</h2>
          <div className="mt-4 flex items-center gap-2 text-[clamp(11px,1.1vw,14px)]">
            <span className="bg-white/20 px-2 py-1 rounded">LVL 1</span>
            <span className="bg-white/20 px-2 py-1 rounded">+5 ⭐</span>
          </div>
          <button className="mt-4 w-full bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold py-3 rounded shadow text-[clamp(14px,1.4vw,18px)]">
            NEW QUESTS!
          </button>
          <div className="mt-4 text-white/90 text-[clamp(12px,1.1vw,16px)]">
            <div className="flex justify-between"><span>BATTLE STARS</span><span>10</span></div>
            <div className="flex justify-between"><span>BARS</span><span>4,826</span></div>
          </div>
        </div>

        {/* Character stage (layered avatar) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-40px] w-[460px] h-[880px] flex items-end justify-center z-20">
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[440px] h-[440px] rounded-full blur-3xl bg-cyan-300/50" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-12 rounded-full bg-black/50 blur" />
          <div className="relative w-[440px] h-[820px] flex items-end justify-center">
            <AvatarLayers />
          </div>
        </div>

        {/* Mode card + Play/Change */}
        <div className="absolute right-10 top-32 w-[420px]">
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-4 text-white font-extrabold text-[clamp(16px,1.8vw,24px)]">SOLO</div>
            <div className="bg-sky-200 aspect-[16/9] flex items-center justify-center text-sky-900 font-bold text-[clamp(14px,1.5vw,20px)]">MODE PREVIEW</div>
            <div className="bg-blue-700 p-3 text-right">
              <button className="relative inline-block mr-2">
                <span className="absolute -inset-1 bg-black/40 rounded-lg" />
                <span className="relative inline-flex items-center gap-3 rounded-lg overflow-hidden">
                  <span className="bg-yellow-400 px-5 py-4 font-black tracking-wide text-[clamp(18px,2.2vw,28px)]">PLAY!</span>
                </span>
              </button>
              <Link href="/locker" className="relative inline-block align-middle">
                <span className="inline-flex items-center rounded-lg overflow-hidden">
                  <span className="bg-blue-500 px-4 py-4 text-white font-bold text-[clamp(14px,1.6vw,20px)]">CHANGE</span>
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Season label */}
        <div className="absolute left-1/2 -translate-x-1/2 top-12 bg-white/90 text-black px-6 py-2 rounded-full shadow z-10 text-[clamp(12px,1.4vw,18px)]">
          Season 1 — PowerPlay Cup
        </div>
      </div>
    </div>
  );
}
