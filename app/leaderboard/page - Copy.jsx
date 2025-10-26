'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LeaderboardPreviewCard from '../../components/LeaderboardPreviewCard';

export default function LeaderboardPage() {
  const [pointsLeaders, setPointsLeaders] = useState([]);
  const [workoutLeaders, setWorkoutLeaders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [sessionStats, setSessionStats] = useState({ sessions: 0, totalTime: 0, wins: 0 });

  const fetchWorkoutStats = async (playerId) => {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('player_id', playerId);
    if (!sessions) return;

    const sessionsCount = sessions.length;
    const totalTime = sessions.reduce((acc, s) => acc + (s.work_time || 0), 0);
    const winCount = sessions.filter(s => s.is_win).length;
    setSessionStats({ sessions: sessionsCount, totalTime, wins: winCount });
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: player, error } = await supabase
          .from('players')
          .select('*')
          .eq('auth_id', user.id)
          .single();

        if (error) console.error('Player fetch error:', error);
        if (player) {
          setCurrentPlayer(player);
          await fetchWorkoutStats(player.id);
        }
      }

      const { data: points } = await supabase.rpc('get_leaderboard');
      const { data: workouts } = await supabase.from('public_leaderboard').select('*');

      setPointsLeaders(Array.isArray(points) ? points : []);
      setWorkoutLeaders(Array.isArray(workouts) ? workouts : []);
    };

    fetchData();
  }, []);

  return (
   <main
    className="min-h-screen bg-no-repeat bg-cover bg-center px-4 py-6 text-white"
    style={{
      backgroundImage: "url('/images/locker_room_background.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  >
    <div className="max-w-7xl mx-auto space-y-6">
        {/* Player Card */}
        <section>
          {currentPlayer ? (
            <div className="bg-gray-900/90 border border-yellow-500 p-4 rounded-xl shadow-md flex items-center gap-4">
              <img
                src={currentPlayer.avatar_url?.startsWith('http')
                  ? currentPlayer.avatar_url
                  : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${currentPlayer.avatar_url}`}
                alt="Avatar"
                className="w-16 h-16 object-cover rounded-full border-2 border-yellow-400 shrink-0"
                style={{ minWidth: '64px', minHeight: '64px' }}
              />
              <div>
                <h2 className="text-lg font-bold text-yellow-300">{currentPlayer.name}</h2>
                <p className="text-xs text-gray-400">Team: {currentPlayer.team}</p>
                <p className="text-xs text-gray-400">Country: {currentPlayer.country}</p>
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  <span className="text-yellow-400">🏆 {currentPlayer.points} pts</span>
                  <span className="text-pink-400">🔥 {sessionStats.sessions} workouts</span>
                  <span className="text-blue-300">⏱️ {Math.round(sessionStats.totalTime)} mins</span>
                  <span className="text-green-400">✅ {sessionStats.wins} wins</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/80 border border-gray-600 p-4 rounded-xl text-center">
              <p className="text-gray-300">You're not ranked yet. Complete your first workout to enter the leaderboard!</p>
            </div>
          )}
        </section>

        {/* Leaderboards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <section className="bg-gray-900/90 border border-yellow-500 p-4 rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-yellow-400 mb-3 text-center">🏆 Points Leaderboard</h2>
            <LeaderboardPreviewCard players={pointsLeaders} highlightId={currentPlayer?.id} />
          </section>

          <section className="bg-gray-900/90 border border-pink-500 p-4 rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-pink-400 mb-3 text-center">💪 Workout Sessions</h2>
            <LeaderboardPreviewCard players={workoutLeaders} highlightId={currentPlayer?.id} />
          </section>

          <section className="bg-gray-900/80 border border-yellow-500 p-4 rounded-xl shadow-md flex flex-col justify-center items-center">
            <h3 className="text-lg font-bold text-yellow-300 mb-2">🤝 Team Rankings</h3>
            <p className="text-sm text-gray-400 italic">Coming Soon</p>
          </section>
        </div>
      </div>
    </main>
  );
}
