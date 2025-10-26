"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Image from "next/image";
import Link from "next/link";
import "@fontsource/rajdhani/700.css";

export default function Homepage() {
  const [player, setPlayer] = useState(null);
  const [rank, setRank] = useState(null);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [dailyWinner, setDailyWinner] = useState(null);
  const musicRef = useRef(null);

  const lastMatch = {
    goals: 2,
    assists: 1,
    cleanSheet: true,
    win: true,
    xpEarned: 75,
  };

  useEffect(() => {
    const setupMusic = async () => {
      if (typeof window === "undefined") return;
      const { MusicManager } = await import("../../lib/musicManager");
      const mgr = new MusicManager();
      mgr.init();
      mgr.initOnUserInteraction();
      musicRef.current = mgr;
    };
    setupMusic();
  }, []);

  useEffect(() => {
    const loadHomepage = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return (window.location.href = "/login");

      let { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (!playerData) {
        const { data: newPlayer } = await supabase
          .from("players")
          .insert([{ auth_id: user.id, name: "New Player", points: 0 }])
          .select()
          .single();
        playerData = newPlayer;
      }

      setPlayer(playerData);
      setStreak(playerData.streak || 0);
      setLongestStreak(playerData.longest_streak || 0);

      const { data: allPlayers } = await supabase
        .from("players")
        .select("id, points");
      const sorted = allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
      const position = sorted.findIndex((p) => p.id === playerData.id);
      setRank(position >= 0 ? position + 1 : null);

      const { data: daily } = await supabase
        .from("daily_winners")
        .select("player_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setDailyWinner(daily?.player_name);
    };

    loadHomepage();
  }, []);

  if (!player) {
    return <div className="text-white text-center mt-10">Loading your dashboard...</div>;
  }

  return (
    <main className="min-h-screen text-white font-[Rajdhani] p-6 flex flex-col items-center relative overflow-hidden">
      {/* Background image overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/futuristic-football-bg.jpg"
          alt="Background"
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-black opacity-60" />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center w-full max-w-[1600px] px-6 py-4 border-b border-gray-700 bg-gray-900 rounded-lg mb-4 z-10">
        <div className="flex items-center gap-4">
          <Image src="/powerplay-logo.png" alt="PowerPlay Logo" width={120} height={120} />
          <div className="text-3xl font-bold text-white uppercase tracking-wide">PowerPlay</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase">{player.name}</p>
            <p className="text-md font-bold text-yellow-400 tracking-wide">Rank #{rank}</p>
            <p className="text-sm text-green-400 uppercase">🔥 Streak: {streak}</p>
            <p className="text-sm text-blue-400 uppercase">🏆 Longest: {longestStreak}</p>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-500">
            <Image
              src={
                player.avatar_url?.startsWith("http")
                  ? player.avatar_url
                  : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`
              }
              alt="Avatar"
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Dashboard Tiles */}
      <div className="grid grid-cols-12 auto-rows-[minmax(150px,_auto)] gap-4 w-full max-w-[1600px] z-10">

        {/* Training Zone */}
        <Link href="/training-zone" className="group col-span-6 row-span-2 bg-gray-800 p-4 rounded-xl relative overflow-hidden shadow-lg hover:scale-[1.01] transition-transform duration-200 border border-yellow-500 hover:shadow-md hover:border-yellow-400">
          <Image src="/training-zone.png" alt="Training Zone" fill className="object-cover opacity-30 absolute inset-0 z-0" />
          <div className="z-10 relative">
            <h2 className="text-3xl font-extrabold uppercase tracking-wider text-white drop-shadow-md">Training Zone</h2>
            <p className="mt-2 text-sm uppercase text-yellow-300 font-semibold tracking-wide transition-transform group-hover:translate-y-1 duration-200">Train. Grow. Earn XP.</p>
            <p className="text-xs text-gray-300 italic">Unlock your full potential — one session at a time.</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow-md w-fit">
              <span className="uppercase">XP</span>
              <span className="text-sm">{player.points || 0}</span>
            </div>
          </div>
        </Link>

        {/* Game Zone */}
        <Link href="/game-zone" className="group col-span-3 row-span-2 bg-gray-800 p-4 rounded-xl shadow-md hover:scale-[1.01] transition-transform duration-200 relative overflow-hidden border border-yellow-500 hover:shadow-md hover:border-yellow-400">
          <Image src="/game-zone.png" alt="Game Zone" fill className="object-cover opacity-20 absolute inset-0 z-0" />
          <div className="z-10 relative">
            <h2 className="text-xl font-extrabold uppercase tracking-wide text-white drop-shadow-md">Game Zone</h2>
            <p className="mt-2 text-sm text-green-300 uppercase font-semibold">Play. Score. Win. Earn XP.</p>
            <p className="text-xs text-gray-300 italic">Track your game-day performance and rise with your squad.</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-green-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow-md w-fit">
              <span className="uppercase">XP</span>
              <span className="text-sm">{player.points || 0}</span>
            </div>
            <div className="mt-4 text-xs text-gray-200">
              <p className="font-bold text-white mb-1">Last Match:</p>
              <ul className="space-y-1">
                <li>⚽ Goals: {lastMatch.goals}</li>
                <li>🎯 Assists: {lastMatch.assists}</li>
                <li>🛡️ Clean Sheet: {lastMatch.cleanSheet ? "✅" : "❌"}</li>
                <li>🏆 Win: {lastMatch.win ? "✅" : "❌"}</li>
              </ul>
              <p className="mt-2 text-lime-300 font-bold">+{lastMatch.xpEarned} XP</p>
              <div className="mt-1 w-full bg-gray-700 rounded-full h-2">
                <div className="bg-lime-400 h-2 rounded-full" style={{ width: `${lastMatch.xpEarned}%` }}></div>
              </div>
            </div>
          </div>
        </Link>

        {/* Locker Room */}
        <Link href="/locker-room" className="col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md flex flex-col items-center justify-center border border-yellow-500 hover:shadow-xl hover:border-yellow-400 hover:scale-[1.01] transition-transform">
          <Image src="/locker_room_logo.png" alt="Locker Room" width={180} height={70} className="mb-2 object-contain" />
          <h2 className="text-xl font-bold uppercase tracking-wide">Locker Room</h2>
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className="col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md flex flex-col items-center justify-center border border-yellow-500 hover:shadow-xl hover:border-yellow-400 hover:scale-[1.01] transition-transform">
          <Image src="/notifications.png" alt="Notifications" width={120} height={50} className="mb-2 object-contain" />
          <h2 className="text-xl font-bold uppercase tracking-wide">Notifications</h2>
        </Link>

        {/* Daily Challenge */}
        <Link href="/skill-session" className="col-span-3 row-span-1 bg-gray-800 p-4 rounded-xl shadow-md flex flex-col justify-between border border-yellow-500 hover:shadow-xl hover:border-yellow-400 hover:scale-[1.01] transition-transform">
          <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Daily Challenge</h2>
          <p className="text-sm text-gray-400">Compete to win rewards today.</p>
          {dailyWinner && <p className="text-sm text-lime-400">🏅 {dailyWinner}</p>}
        </Link>

        {/* Live Feed */}
        <div className="col-span-3 row-span-1 bg-gray-800 p-4 rounded-xl shadow-md overflow-hidden border border-yellow-500 hover:shadow-xl hover:border-yellow-400 hover:scale-[1.01] transition-transform">
          <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Live Feed</h2>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>⚡ New training module just dropped!</li>
            <li>🔥 PlayerOne completed 5 streaks in a row</li>
            <li>🚨 Tournament Creator launches this weekend</li>
            <li>🎖️ {player.name} just hit a new personal best!</li>
          </ul>
        </div>

        {/* Global Standings */}
        <div className="col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md border border-yellow-500 hover:shadow-xl hover:border-yellow-400 hover:scale-[1.01] transition-transform">
          <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Global Standings</h2>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>1. PlayerOne - 1245 pts</li>
            <li>2. {player.name} - {player.points || 0} pts</li>
            <li>3. PlayerX - 1180 pts</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
