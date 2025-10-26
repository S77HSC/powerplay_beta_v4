'use client';

import Link from 'next/link';
import AvatarLayers from '../../components/AvatarLayers';

export default function LobbyPage() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Background */}
      <img
        src="/images/futuristic-stadium.png"
        alt="Futuristic Football Stadium"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Top nav bar */}
      <div className="absolute left-0 right-0 top-0 h-16 flex items-center gap-8 px-10">
        <nav className="flex items-center gap-8 text-white font-bold text-lg">
          <Link href="/play" className="px-4 py-2 rounded bg-white text-darkBlue">
            PLAY
          </Link>
          <Link href="/training-zone">BATTLE PASS</Link>
          <Link href="/locker" className="hover:opacity-90">
            LOCKER
          </Link>
          <Link href="/item-shop">ITEM SHOP</Link>
          <Link href="/player-dashboard">CAREER</Link>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-lg">
          <div className="rounded bg-primary px-4 py-2 text-primary-foreground font-extrabold">
            EUROPE
          </div>
          <div className="rounded bg-primary px-4 py-2 text-primary-foreground font-extrabold">
            8,550
          </div>
        </div>
      </div>

      {/* Left HUD */}
      <div className="absolute left-12 top-36 w-[500px] text-white drop-shadow">
        <h3 className="text-sky-100/80 text-base tracking-wide">CHAPTER 1</h3>
        <h2 className="text-6xl font-extrabold leading-none">SEASON 1</h2>
        <div className="mt-6 flex items-center gap-3 text-sm">
          <span className="bg-white/20 px-3 py-2 rounded">LVL 1</span>
          <span className="bg-white/20 px-3 py-2 rounded">+5 ⭐</span>
        </div>
        <Link
          href="/skill-session"
          className="mt-6 block w-full bg-cyan-400 hover:bg-cyan-300 text-darkBlue font-extrabold py-4 rounded shadow text-center text-xl"
        >
          DAILY CHALLENGE!
        </Link>
        <div className="mt-6 text-lg text-white/90 space-y-2">
          <div className="flex justify-between">
            <span>BATTLE STARS</span>
            <span>10</span>
          </div>
          <div className="flex justify-between">
            <span>BARS</span>
            <span>4,826</span>
          </div>
        </div>
      </div>

      {/* Character stage */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[520px] h-[880px] flex items-end justify-center">
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full blur-3xl bg-cyan-300/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-12 rounded-full bg-black/50 blur" />
        <AvatarLayers />
      </div>

      {/* Right mode card */}
      <div className="absolute right-14 top-48 w-[500px]">
        <div className="rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-5 text-white font-extrabold text-2xl">
            SOLO
          </div>
          <div className="bg-sky-200 aspect-[16/9] flex items-center justify-center text-sky-900 font-bold text-xl">
            MODE PREVIEW
          </div>
          <div className="bg-blue-700 p-4 text-right">
            <button className="relative inline-block">
              <span className="absolute -inset-1 bg-black/40 rounded-lg" />
              <span className="relative inline-flex items-center gap-4 rounded-lg overflow-hidden">
                <span className="bg-yellow-400 px-6 py-5 text-3xl font-black tracking-wide">
                  PLAY!
                </span>
                <span className="bg-blue-500 px-5 py-5 text-white font-bold text-lg">
                  CHANGE
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Center season label */}
      <div className="absolute left-1/2 -translate-x-1/2 top-28 bg-secondary px-8 py-3 rounded-full text-secondary-foreground shadow text-xl font-bold">
        Season 1 — PowerPlay Cup
      </div>
    </div>
  );
}
