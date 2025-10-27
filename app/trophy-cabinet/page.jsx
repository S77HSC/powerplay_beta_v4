"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CollectiblesTray from "../../lobbycomponents/CollectiblesTray";
import NeonIconBar from "../../lobbycomponents/NeonIconBar";
import TrophyShelf from "../../lobbycomponents/TrophyShelf";

export default function TrophyCabinetPage() {
  const [playerId, setPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Resolve playerId from current auth user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        if (!error) setPlayerId(data?.id ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main
      className="min-h-screen p-3 md:p-6 text-white"
      style={{
        backgroundImage: "url('/images/trophy_cabinet.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-30 mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/45 p-2.5 md:p-3 backdrop-blur-md">
        <NeonIconBar />
        <div className="flex gap-2">
          <Link
            href="/player-dashboard"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            ← Dashboard
          </Link>
          <Link
            href="/lobby"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Home
          </Link>
        </div>
      </div>

      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Trophy Cabinet</h1>
        <p className="text-sm md:text-base text-slate-200/90">
          All your cards, trophies, badges, and collectibles in one place.
        </p>
      </header>

      {/* Cards / collectibles */}
      <section className="mb-6 rounded-2xl border border-yellow-400/40 bg-black/50 p-3 md:p-4 shadow-[0_0_40px_rgba(255,215,0,0.12)] backdrop-blur-xl">
        {loading ? (
          <div className="p-6 text-slate-200/90">Loading your cabinet…</div>
        ) : playerId ? (
          <CollectiblesTray playerId={playerId} orbitronClass="font-arena" />
        ) : (
          <div className="p-6 text-slate-200/90">No player found for this account.</div>
        )}
      </section>

      {/* Trophies */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4 backdrop-blur-xl">
        <h2 className="mb-3 text-xl md:text-2xl font-semibold">Weekly Trophies</h2>
        {loading ? (
          <div className="p-6 text-slate-200/90">Loading trophies…</div>
        ) : playerId ? (
          <TrophyShelf playerId={playerId} />
        ) : (
          <div className="p-6 text-slate-200/90">Sign in to view your trophies.</div>
        )}
      </section>
    </main>
  );
}
