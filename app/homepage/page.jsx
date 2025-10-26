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
  const [unread, setUnread] = useState(0); // unread notifications badge
  const musicRef = useRef(null);

  const lastMatch = {
    goals: 2,
    assists: 1,
    cleanSheet: true,
    win: true,
    xpEarned: 75,
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("../../lib/musicManager").then(({ MusicManager }) => {
        const mgr = new MusicManager();
        mgr.init();
        mgr.initOnUserInteraction();
        musicRef.current = mgr;
      });
    }
  }, []);

  // helper to (re)fetch unread notifications count
  const fetchUnread = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("player_auth_id", user.id)
      .eq("is_read", false);
    if (!error) setUnread(count || 0);
  };

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
        const { data: newPlayer, error } = await supabase
          .from("players")
          .insert([{ auth_id: user.id, name: "New Player", points: 0 }])
          .select()
          .single();

        if (error || !newPlayer) {
          console.error("Failed to create new player:", error);
          return;
        }

        playerData = newPlayer;
      }

      if (!playerData) return;

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

      // first pull of unread
      await fetchUnread();
    };

    loadHomepage();
  }, []);

  // clear badge instantly when notifications page marks read,
  // and re-check on window focus
  useEffect(() => {
    const handleRead = () => setUnread(0);
    const handleFocus = () => fetchUnread();

    window.addEventListener("notifications-read", handleRead);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("notifications-read", handleRead);
      window.removeEventListener("focus", handleFocus);
    };
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
          className="object-cover opacity-30 h-full"
          priority
        />
        <div className="absolute inset-0 bg-black opacity-30" />
      </div>

      {/* Header (no wrap so grid below doesn’t shift) */}
      <div className="flex justify-between items-center w-full max-w-[1600px] px-6 py-3 border-b border-cyan-400 bg-gray-900 rounded-lg mb-4 z-10 flex-nowrap gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <Image src="/powerplay-logo.png" alt="PowerPlay Logo" width={80} height={80} />
          <div className="text-2xl font-bold uppercase tracking-wide">PowerPlay</div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase">{player.name}</p>
            <p className="text-md font-bold text-yellow-400 tracking-wide">Rank #{rank}</p>
            <p className="text-sm text-green-400 uppercase">🔥 Streak: {streak}</p>
            <p className="text-sm text-blue-400 uppercase">🏆 Longest: {longestStreak}</p>
          </div>
          {/* Slightly larger avatar, won’t force wrap */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-yellow-500 shadow-lg shrink-0">
            <Image
              src={
                player.avatar_url?.startsWith("http")
                  ? player.avatar_url
                  : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`
              }
              alt="Avatar"
              width={240}
              height={240}
              className="object-cover w-full h-full"
            />
          </div>
          <Link href="/friends" className="shrink-0">
            <Image
              src="/images/social-icon.png"
              alt="Social Icon"
              width={90}
              height={90}
              className="cursor-pointer hover:scale-105 transition-transform"
            />
          </Link>
          <Link href="/settings" className="shrink-0">
            <Image
              src="/images/settings-icon.png"
              alt="Settings"
              width={80}
              height={80}
              className="ml-2 cursor-pointer"
            />
          </Link>
        </div>
      </div>

      {/* Dashboard Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 xl:grid-cols-12 auto-rows-[minmax(180px,_auto)] md:auto-rows-[minmax(160px,_auto)] gap-4 w-full max-w-[1600px] z-10">

        {/* Training Zone */}
        <Link
          href="/training-zone"
          className="group col-span-12 sm:col-span-6 md:col-span-6 xl:col-span-6 row-span-2 bg-gray-800 p-3 sm:p-4 md:p-5 rounded-xl relative overflow-hidden shadow-lg transition-transform duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl border border-yellow-500 hover:border-yellow-400"
        >
          <Image
            src="/images/training-zone.png"
            alt="Training Zone"
            fill
            className="absolute inset-0 object-cover opacity-60 sm:opacity-90 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-0" />
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold uppercase tracking-wider text-white drop-shadow-md">
              Training Zone
            </h2>
            <p className="mt-2 text-sm uppercase text-yellow-300 font-semibold tracking-wide transition-transform group-hover:translate-y-1 duration-200">
              Train. Grow. Earn XP.
            </p>
            <p className="text-xs text-gray-300 italic">
              Unlock your full potential — one session at a time.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow-md w-fit">
              <span className="uppercase">XP</span>
              <span className="text-sm">{player.points || 0}</span>
            </div>
          </div>
        </Link>

        {/* Game Zone */}
        <Link
          href="/game-zone"
          className="group col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-2 bg-gray-800 p-3 sm:p-4 md:p-5 rounded-xl shadow-md transition-transform duration-200 relative overflow-hidden hover:scale-[1.01] hover:shadow-md border border-yellow-500 hover:border-yellow-400"
        >
          <Image
            src="/images/game-zone.png"
            alt="Game Zone"
            fill
            className="absolute inset-0 object-cover opacity-60 sm:opacity-90 pointer-events-none"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-0" />
          <div className="relative z-10">
            <h2 className="text-xl font-extrabold uppercase tracking-wide text-white drop-shadow-md">
              Game Zone
            </h2>
            <p className="mt-2 text-sm text-green-300 uppercase font-semibold">
              Play. Score. Win. Earn XP.
            </p>
            <p className="text-xs text-gray-300 italic">
              Track your game-day performance and rise with your squad.
            </p>
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
                <div
                  className="bg-lime-400 h-2 rounded-full"
                  style={{ width: `${lastMatch.xpEarned}%` }}
                />
              </div>
            </div>
          </div>
        </Link>

        {/* Locker Room */}
        <Link
          href="/locker-room"
          className="col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md flex flex-col items-center justify-center hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400"
        >
          <Image src="/locker_room_logo.png" alt="Locker Room" width={180} height={70} className="mb-2 object-contain" />
          <h2 className="text-xl font-bold uppercase tracking-wide">Locker Room</h2>
        </Link>

        {/* Notifications (with polished badge) */}
        <Link
          href="/notifications"
          className="relative overflow-visible col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md flex flex-col items-center justify-center hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400"
        >
          {unread > 0 && (
            <div
              className="absolute -top-2 -right-2"
              aria-label={`${unread} unread notifications`}
              title={`${unread} unread notifications`}
            >
              <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
              <span className="relative grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-[10px] font-bold text-white ring-2 ring-gray-900 shadow-lg">
                {unread > 9 ? "9+" : unread}
              </span>
            </div>
          )}
          <Image src="/images/notifications.png" alt="Notifications" width={120} height={50} className="mb-2 object-contain" />
          <h2 className="text-xl font-bold uppercase tracking-wide">Notifications</h2>
        </Link>

        {/* Daily Challenge */}
        <Link
          href="/skill-session"
          className="group col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1 bg-gray-800 p-4 rounded-xl shadow-md hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400 relative"
        >
          <Image
            src="/images/daily_challenge.png"
            alt="Daily Challenge"
            width={80}
            height={80}
            className="absolute top-0 right-1 max-w-[100px] h-auto opacity-90"
          />
          <div className="relative z-10">
            <h2 className="text-xl font-bold uppercase tracking-wide text-cyan-400 mb-2">Daily Challenge</h2>
            <p className="text-gray-300 text-sm">Compete to win rewards today.</p>
          </div>
        </Link>

        {/* Live Feed */}
        <Link
          href="/live-news"
          className="col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1"
        >
          <div className="bg-gray-800 p-4 rounded-xl shadow-md overflow-hidden hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400 relative h-full w-full">
            <Image
              src="/images/live_feed.png"
              alt="Live Feed Icon"
              width={80}
              height={80}
              className="absolute top-0 right-0 max-w-[100px] h-auto opacity-90"
            />
            <div className="relative z-10">
              <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Live Feed</h2>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>⚡ New training module just dropped!</li>
                <li>🔥 PlayerOne completed 5 streaks in a row</li>
                <li>🚨 Tournament Creator launches this weekend</li>
                <li>🎖️ {player.name} just hit a new personal best!</li>
              </ul>
            </div>
          </div>
        </Link>

        {/* Global Standings */}
        <Link
          href="/leaderboard"
          className="col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400 relative"
        >
          <img
            src="/images/leaderboard_logo.png"
            alt="Leaderboard Logo"
            className="absolute top-2 right-2 w-26 h-20 object-contain z-10"
          />
          <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Global Standings</h2>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>1. PlayerOne - 1245 pts</li>
            <li>2. {player.name} - {player.points || 0} pts</li>
            <li>3. PlayerX - 1180 pts</li>
          </ul>
        </Link>

        {/* Player Dashboard */}
        <Link
          href="/player-dashboard"
          className="col-span-12 sm:col-span-6 md:col-span-3 xl:col-span-3 row-span-1 bg-gray-800 p-3 rounded-xl shadow-md flex flex-col items-center justify-center hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400"
        >
          <Image
            src="/images/progress_tracker.png"
            alt="Player Dashboard"
            width={100}
            height={100}
            className="mb-2 object-contain"
          />
          <h2 className="text-xl font-bold uppercase tracking-wide text-white mt-2">
            Player Dashboard
          </h2>
        </Link>

      </div>
    </main>
  );
}
