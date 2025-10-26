'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { sessionData } from '../lib/sessionData';

export default function SkillSession() {
  const [player, setPlayer] = useState(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [dailySkills, setDailySkills] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      setPlayer(playerData);
      setPoints(playerData?.points || 0);
      setStreak(playerData?.streak || 0);

      const today = new Date().toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('player_id', playerData.id)
        .gte('completed_at', today);

      setTodayCompleted((sessions || []).length > 0);
    };

    fetchPlayer();
  }, []);

  useEffect(() => {
    const fetchOrCreateDailyChallenge = async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data: challenge } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('date', today)
        .single();

      if (challenge) {
        setDailySkills([
          { ...sessionData[challenge.session_a], sessionKey: challenge.session_a },
          { ...sessionData[challenge.session_b], sessionKey: challenge.session_b }
        ]);
      } else {
        const all = Object.entries(sessionData);
        const seed = new Date().getDate();
        const shuffled = [...all].sort((a, b) =>
          (a[0] + seed).localeCompare(b[0] + seed)
        );
        const selected = shuffled.slice(0, 2);

        await supabase.from('daily_challenges').insert([
          {
            date: today,
            session_a: selected[0][0],
            session_b: selected[1][0]
          }
        ]);

        setDailySkills([
          { ...selected[0][1], sessionKey: selected[0][0] },
          { ...selected[1][1], sessionKey: selected[1][0] }
        ]);
      }
    };

    fetchOrCreateDailyChallenge();
  }, []);

  const handleSessionSelect = (key) => {
    router.push(`/skill-player?session=${key}`);
  };

  return (
    <main className="min-h-screen bg-cover bg-center text-white px-4 py-8" style={{ backgroundImage: "url('/images/daily_challenge_background.png')" }}>
      <div className="max-w-7xl mx-auto">

        {/* Back Button */}
        <div className="mb-6">
          <button onClick={() => router.push('/')} className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded border border-white/20 transition">
            ← Back to Home
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* Daily Challenge */}
          <div className="lg:col-span-2 bg-gray-800 p-4 rounded-xl shadow-md border border-yellow-500 relative overflow-hidden hover:scale-[1.01] transition-transform text-sm">
            <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${dailySkills[0]?.thumbnail || ''})` }} />
            <div className="relative z-10">
              <h2 className="text-lg font-bold text-yellow-300 uppercase mb-1">Daily Challenge</h2>
              <p className="mb-2">+25 XP for completing both drills</p>
              <ul className="text-xs text-white mb-2 list-disc list-inside">
                {dailySkills.map((skill, i) => (
                  <li key={i}>{skill?.title}</li>
                ))}
              </ul>
              <p className="text-xs text-orange-400">🏆 {todayCompleted ? 'Completed' : '+2x XP Bonus'}</p>
              <p className="text-xs text-cyan-400 mb-2">🔥 Streak: {streak} day{streak !== 1 && 's'}</p>
              <button
                onClick={() => router.push(`/skill-session/daily-player?sessionA=${dailySkills[0].sessionKey}&sessionB=${dailySkills[1].sessionKey}`)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded shadow text-xs"
              >
                Start Daily Challenge
              </button>
            </div>
          </div>

          {/* Skills Grid */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Object.entries(sessionData).map(([key, info]) => {
              const unlocked = points >= info.unlockXP;
              return (
                <div key={key} className="bg-gray-900 p-3 rounded-xl shadow-md border border-gray-700 hover:shadow-lg transition-all flex flex-col items-start overflow-hidden">
                  <div className="w-full h-32 mb-2 relative overflow-hidden rounded-md">
                    <img src={info.thumbnail} alt={info.title} className="w-full h-full object-cover opacity-90" />
                  </div>
                  <h3 className="font-semibold text-yellow-300 text-sm leading-tight mb-1">{info.title}</h3>
                  <p className="text-gray-300 text-xs mb-2">{info.description}</p>
                  {unlocked ? (
                    <button
                      onClick={() => handleSessionSelect(key)}
                      className="mt-auto bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-3 py-1 rounded"
                    >
                      ▶ View Skill
                    </button>
                  ) : (
                    <p className="text-gray-400 text-xs mt-auto">🔒 Unlocks at {info.unlockXP} XP</p>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </main>
  );
}
