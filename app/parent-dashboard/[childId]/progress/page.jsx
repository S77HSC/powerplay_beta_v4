'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';

export default function ChildProgressPage() {
  const { childId } = useParams();
  const router = useRouter();
  const [child, setChild] = useState(null);
  const [xpLog, setXpLog] = useState([]);
  const [unlockedItems, setUnlockedItems] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [missedYesterday, setMissedYesterday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', childId)
        .eq('parent_id', user.id)
        .single();

      if (!player) return router.push('/parent-dashboard');
      setChild(player);

      const { data: xpLogs } = await supabase
        .from('xp_logs')
        .select('*')
        .eq('user_id', childId)
        .order('timestamp', { ascending: false });

      const { data: items } = await supabase
        .from('player_items')
        .select('*')
        .eq('player_id', childId);

      const { data: workoutData } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('player_id', childId);

      setXpLog(xpLogs || []);
      setUnlockedItems(items || []);
      setWorkouts(workoutData || []);

      // Check for yesterday's workout
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
      const yEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
      const didWorkoutYesterday = workoutData?.some(
        (w) => w.completed && w.created_at >= yStart && w.created_at <= yEnd
      );
      setMissedYesterday(!didWorkoutYesterday);

      setLoading(false);
    };

    fetchProgress();
  }, [childId, router]);

  const totalWorkoutXP = workouts.reduce((acc, w) => acc + (w.xp_earned || 0), 0);
  const totalWorkouts = workouts.filter(w => w.completed).length;

  if (loading) return <p className="text-white text-center">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Progress for {child.name}</h1>

      <section className="mb-6">
        <h2 className="text-xl mb-2">XP & Account</h2>
        <p>Total XP: {child.points}</p>
        <p>Subscription: {child.subscription_active ? '✅ Active' : '❌ Inactive'}</p>
        <p>Verified: {child.is_verified ? '✅ Yes' : '❌ No'}</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl mb-2">Unlocked Items</h2>
        <ul className="list-disc list-inside text-sm">
          {unlockedItems.map((item) => (
            <li key={item.id}>{item.item_name || item.item_id}</li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl mb-2">Workout Summary</h2>
        <p>Total Workouts Completed: {totalWorkouts}</p>
        <p>Total XP from Workouts: {totalWorkoutXP}</p>
        {missedYesterday && (
          <p className="text-red-500 mt-2">⚠️ Missed yesterday's daily challenge</p>
        )}
      </section>

      <section>
        <h2 className="text-xl mb-2">XP Log</h2>
        <ul className="text-sm space-y-1">
          {xpLog.map((log) => (
            <li key={log.id}>
              [{new Date(log.timestamp).toLocaleDateString()}] {log.amount} XP — {log.source}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
