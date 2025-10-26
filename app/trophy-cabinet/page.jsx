"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CollectiblesTray from "../../lobbycomponents/CollectiblesTray";
import NeonIconBar from "../../lobbycomponents/NeonIconBar";

export default function TrophyCabinetPage() {
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("players").select("id").eq("auth_id", user.id).single();
      setPlayerId(data?.id ?? null);
    })();
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
      <div className="sticky top-0 z-30 flex items-center justify-between bg-black/45 backdrop-blur-md p-2.5 md:p-3 border-b border-white/10 rounded-xl mb-4">
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

      {/* Big roomy cabinet panel */}
      <section className="rounded-2xl border border-yellow-400/40 bg-black/50 backdrop-blur-xl p-3 md:p-4 shadow-[0_0_40px_rgba(255,215,0,0.12)]">
        {playerId ? (
          <CollectiblesTray playerId={playerId} orbitronClass="font-arena" />
        ) : (
          <div className="text-slate-200/90 p-6">Loading your cabinet…</div>
        )}
      </section>
    </main>
  );
}