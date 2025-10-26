"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { sessionData } from "../lib/sessionData";

export default function SkillSession() {
  const [player, setPlayer] = useState(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [dailySkills, setDailySkills] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: playerData } = await supabase
          .from("players")
          .select("*")
          .eq("auth_id", user.id)
          .single();

        if (!playerData) return;

        setPlayer(playerData);
        setPoints(playerData.points || 0);
        setStreak(playerData.streak || 0);

        const today = new Date().toISOString().split("T")[0];
        const { data: sessions } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("player_id", playerData.id)
          .gte("completed_at", today);

        setTodayCompleted(sessions?.length > 0);
      } catch (err) {
        console.error("❌ Failed to load player data:", err.message);
      }
    };
    fetchPlayer();
  }, []);

  useEffect(() => {
    if (!player) return;
    const unlocked = Object.entries(sessionData).filter(
      ([_, info]) => player.points >= info.unlockXP
    );

    if (unlocked.length >= 2) {
      const seed = new Date().getDate();
      const shuffled = [...unlocked].sort(
        (a, b) => ((a[0] + seed).localeCompare(b[0] + seed))
      );
      const selected = shuffled.slice(0, 2).map(([key, info]) => ({
        ...info,
        sessionKey: key,
      }));
      setDailySkills(selected);
    }
  }, [player]);

  const handleSessionSelect = (key) => {
    router.push(`/skill-player?session=${key}`);
  };

  const totalReps = 5 * dailySkills.length;
  const totalTimePerSkill = 5 * (30 + 15) - 15; // 5 reps of 30s + 15s rest, minus final rest
  const totalTime = totalTimePerSkill * dailySkills.length;

  return (
    <main className="relative min-h-screen text-white px-6 py-10 font-sans overflow-hidden bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19]">
      <div
        className="absolute inset-0 z-0 opacity-30 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}
      ></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-10">

        {/* Desktop top right challenge button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/skill-session/daily')}
            className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-xl shadow-md transition duration-200"
          >
            🎯 Start Daily Challenge
          </button>
        </div>

        {/* Daily Challenge Box */}
        {dailySkills.length === 2 && (
          <div className="bg-white/5 backdrop-blur-md border border-yellow-300 rounded-xl shadow-md px-6 py-5 max-w-5xl mx-auto space-y-4">
            <h3 className="text-xl font-bold text-yellow-300 text-center">
              🔥 Daily Challenge: Skill Combo
            </h3>
            <p className="text-center text-sm text-gray-300">
              Complete both drills today to earn <span className="text-white font-semibold">25 XP</span>!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dailySkills.map((skill, idx) => (
                <div key={idx} className="flex flex-col bg-white/10 p-3 rounded-lg">
                  <img src={skill.thumbnail} alt={skill.title} className="rounded w-full h-28 object-cover mb-2" />
                  <h4 className="text-sm font-semibold text-white">{skill.title}</h4>
                  <p className="text-xs text-gray-400">{skill.description}</p>
                </div>
              ))}
            </div>

            <div className="text-center text-sm text-gray-300 space-y-1">
              <p>⏱ Estimated Time: <span className="text-white">{totalTime}s</span></p>
              <p>🔁 Total Reps: <span className="text-white">{totalReps}</span> (5 per drill)</p>
              <p>🧠 Drills: {dailySkills.map(s => s.title).join(" + ")}</p>
            </div>

            <div className="text-center mt-3 space-y-1">
              {todayCompleted ? (
                <p className="text-green-400 text-sm font-medium">✅ Completed Today</p>
              ) : (
                <p className="text-orange-400 text-sm font-medium">🏆 +2x XP Bonus</p>
              )}
              <p className="text-cyan-400 text-sm">🔥 Streak: {streak} day{streak !== 1 ? 's' : ''}</p>

              <button
                onClick={() => router.push('/skill-session/daily')}
                className="mt-2 bg-gradient-to-r from-cyan-600 to-sky-500 hover:brightness-110 text-white px-5 py-2 rounded shadow"
              >
                Start Daily Challenge
              </button>
            </div>
          </div>
        )}

        {/* Unlocked Skills Grid */}
        <div className="mt-12 max-w-7xl mx-auto">
          <h4 className="text-lg font-bold text-white mb-4">⚽ Practice Any Unlocked Skill</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Object.entries(sessionData)
              .filter(([_, info]) => points >= info.unlockXP)
              .map(([key, skill]) => (
                <div
                  key={key}
                  onClick={() => handleSessionSelect(key)}
                  className="cursor-pointer hover:scale-105 transition bg-white/10 rounded-xl p-2 shadow-md"
                >
                  <img
                    src={skill.thumbnail}
                    alt={skill.title}
                    className="w-full h-[100px] object-cover rounded"
                  />
                  <p className="text-sm text-center text-sky-200 mt-2">{skill.title}</p>
                </div>
              ))}
          </div>
        </div>

      </div>

      {/* Sticky button for mobile */}
      <div className="fixed bottom-4 right-4 z-50 sm:hidden">
        <button
          onClick={() => router.push('/skill-session/daily')}
          className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-4 py-3 rounded-full shadow-lg text-sm font-semibold"
        >
          🎯 Daily Challenge
        </button>
      </div>
    </main>
  );
}
