// homepage/page.jsx

"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Image from "next/image";
import Link from "next/link";
import LeaderboardPreviewCard from "../../components/LeaderboardPreviewCard";
import { MusicManager } from "../../lib/musicManager";

export default function Homepage() {
  const [player, setPlayer] = useState(null);
  const [rank, setRank] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [dailyComplete, setDailyComplete] = useState(false);
  const [dailyBest, setDailyBest] = useState([]);
  const [longestStreakLeaders, setLongestStreakLeaders] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const musicRef = useRef(null);

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
    const fetchPlayer = async () => {
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
      setLongestStreak(playerData.longest_streak || 0);

      const { data: allPlayers } = await supabase.from("players").select("id, points");
      const sorted = allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
      const position = sorted.findIndex((p) => p.id === playerData.id);
      setRank(position >= 0 ? position + 1 : null);
    };

    const fetchLeaders = async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, points, country")
        .order("points", { ascending: false })
        .limit(5);
      setLeaders(data || []);
    };

    fetchPlayer();
    fetchLeaders();
  }, []);

  useEffect(() => {
    if (!player?.id) return;

    const fetchStreak = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: sessionsToday } = await supabase
        .from("workout_sessions")
        .select("created_at")
        .eq("player_id", player.id)
        .gte("created_at", `${today}T00:00:00.000Z`);

      setDailyComplete(sessionsToday?.length >= 2);

      const { data: allSessions } = await supabase
        .from("workout_sessions")
        .select("created_at")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false });

      const days = new Map();
      allSessions?.forEach(({ created_at }) => {
        const day = new Date(created_at).toISOString().split("T")[0];
        days.set(day, (days.get(day) || 0) + 1);
      });

      let streakCount = 0;
      let date = new Date();

      while (true) {
        const key = date.toISOString().split("T")[0];
        if ((days.get(key) || 0) >= 2) {
          streakCount++;
          date.setDate(date.getDate() - 1);
        } else break;
      }

      setStreak(streakCount);
    };

    const fetchDailyBest = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.rpc("get_daily_top_xp", { date_input: today });
      setDailyBest(data || []);
    };

    const fetchLongestStreakLeaders = async () => {
      const { data, error } = await supabase
        .from("players")
        .select("name, longest_streak")
        .order("longest_streak", { ascending: false })
        .limit(5);
      if (!error) setLongestStreakLeaders(data);
    };

    fetchStreak();
    fetchDailyBest();
    fetchLongestStreakLeaders();
  }, [player]);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19] text-white px-4 py-10 font-sans overflow-hidden">
      <button
        onClick={() => {
          const mgr = musicRef.current;
          if (!mgr) return;
          if (mgr.isMuted()) {
            mgr.unmute();
            setIsMuted(false);
          } else {
            mgr.mute();
            setIsMuted(true);
          }
        }}
        className="absolute top-4 right-4 z-50 text-green-400 hover:text-green-200 transition"
      >
        {isMuted ? "🔇 Mute" : "🎵 Music"}
      </button>

      <div className="flex justify-between items-center mb-4 px-2">
        <Image src="/powerplay-logo.png" alt="PowerPlay" width={140} height={60} />
        <div className="flex items-center gap-4">
          <Link href="/user-settings" className="text-cyan-400 hover:text-cyan-200">⚙ Settings</Link>
          <Link href="/logout" className="text-red-400 hover:text-red-300">🔴 Logout</Link>
        </div>
      </div>

      {player && (
        <div className="flex flex-col items-center space-y-1 text-center mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-pink-400 shadow-md">
            <Image
              src={player.avatar_url?.startsWith("http") ? player.avatar_url : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`}
              alt="Avatar"
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="text-base font-semibold">{player.name}</div>
          <div className="text-sm text-yellow-400">Global Rank #{rank}</div>
          <div className="text-sm text-orange-400">🔥 Daily Streak: {streak} day{streak !== 1 ? "s" : ""}</div>
          <div className="text-sm text-cyan-300">🏅 Longest Streak: {longestStreak} days</div>
        </div>
      )}
	<div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}></div>

      {/* Navigation Tiles */}
      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
  <Link href="/skill-session" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/daily-challenge-logo.png" alt="Daily Challenge" width={140} height={60} />
    <p className="text-sm text-blue-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Streak: {streak} {dailyComplete ? '✅' : '⏳'}
    </p>
  </Link>

  <Link href="/player-dashboard" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/dashboard-logo.png" alt="Player Dashboard" width={140} height={60} />
    <p className="text-sm text-indigo-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Track your global progress
    </p>
  </Link>

  <Link href="/workout-builder" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/powerplay-sessionbuilder-logo.png" alt="Workout Builder" width={140} height={60} />
    <p className="text-sm text-green-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Create a custom routine
    </p>
  </Link>

  <Link href="/sacrifice-league/new" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/tournament-sparkle.png" alt="Power League" width={140} height={60} />
    <p className="text-sm text-yellow-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Tournament creator
    </p>
  </Link>

  <Link href="/survivor_mode" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/sacrifice_logo.png" alt="Survivor Mode" width={140} height={60} />
    <p className="text-sm text-red-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Score and survive
    </p>
  </Link>

  <Link href="/powerplay" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/powerplay-logo.png" alt="PowerPlay" width={140} height={60} />
    <p className="text-sm text-purple-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Build. Compete. Dominate.
    </p>
  </Link>

  <Link href="/boostball" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/boostball_logo.png" alt="Boostball" width={140} height={60} />
    <p className="text-sm text-pink-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Fast-paced power play mode
    </p>
  </Link>

  <Link href="/locker-room" className="bg-white/5 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/10 min-h-[200px] max-h-[200px] flex flex-col justify-between items-center hover:shadow-lg hover:scale-[1.03] transition duration-300 ease-out hover:outline hover:outline-1 hover:outline-pink-300">
    <Image src="/locker_room_logo.png" alt="Locker Room Logo" width={140} height={60} />
    <p className="text-sm text-pink-200 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
      Style your look. Earn your gear.
    </p>
  </Link>
</section>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 animate-fade-in">
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <LeaderboardPreviewCard players={leaders} />
        </section>
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <h3 className="text-lg font-bold text-yellow-300 mb-2">🔥 Daily Roundup</h3>
          {dailyBest.length > 0 ? (
            <ul className="text-sm text-white space-y-1">
              {dailyBest.map((entry, idx) => (
                <li key={idx}>{idx + 1}. <span className="text-sky-300">{entry.username}</span> — <strong>{entry.total_xp} XP</strong></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No sessions logged today yet.</p>
          )}
        </section>
      </div>

      {/* Longest Streak Leaderboard */}
      <div className="mt-8 animate-fade-in">
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <h3 className="text-lg font-bold text-cyan-300 mb-2">🏅 Longest Streaks</h3>
          {longestStreakLeaders.length > 0 ? (
            <ul className="text-sm text-white space-y-1">
              {longestStreakLeaders.map((entry, idx) => (
                <li key={idx}>{idx + 1}. <span className="text-yellow-200">{entry.name}</span> — <strong>{entry.longest_streak} days</strong></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No streaks recorded yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
