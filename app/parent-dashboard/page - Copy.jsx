'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [requests, setRequests] = useState([]);
  const [subscribed, setSubscribed] = useState({});
  const [workoutCounts, setWorkoutCounts] = useState({});

  useEffect(() => {
    const fetchChildren = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email);

      const { data: links } = await supabase
        .from('parent_links')
        .select('child_id')
        .eq('parent_email', user.email);

      const childIds = links?.map((l) => l.child_id).filter(Boolean) || [];
      if (childIds.length === 0) {
        setChildren([]);
        return;
      }

      const { data: playerData } = await supabase
        .from('players')
        .select('id, name, subscription_active, points')
        .in('id', childIds);

      setChildren(playerData);

      const { data: xpData } = await supabase
        .from('xp_requests')
        .select('*')
        .in('child_id', childIds);

      setRequests(xpData || []);

      const initialSubs = {};
      const workoutsByChild = {};

      for (const child of playerData) {
        initialSubs[child.id] = child.subscription_active;

        const { data: workouts } = await supabase
          .from('workouts')
          .select('*')
          .eq('player_id', child.id);

        workoutsByChild[child.id] = workouts?.length || 0;
      }

      setSubscribed(initialSubs);
      setWorkoutCounts(workoutsByChild);
    };

    fetchChildren();
  }, []);

  const grantXP = async (childId, xp) => {
    const message = `Parent granted ${xp} XP`;
    await supabase.from('xp_requests').insert({ child_id: childId, requested_xp: xp, status: 'approved', message });
    setRequests((prev) => [...prev, { child_id: childId, requested_xp: xp, status: 'approved', message, created_at: new Date().toISOString() }]);
  };

  const toggleSubscription = async (childId, isActive) => {
    await supabase.from('players').update({ subscription_active: !isActive }).eq('id', childId);
    setSubscribed((prev) => ({ ...prev, [childId]: !isActive }));
  };

  return (
    <>
      <div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}></div>
    <div className="max-w-4xl mx-auto p-4 text-white">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <img src="/powerplay-logo.png" alt="PowerPlay Soccer Logo" className="h-16 w-auto drop-shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold">Parent Dashboard</h1>
            <p className="text-sm text-gray-400">Logged in as {userEmail}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {children.length === 0 ? (
        <div className="text-yellow-400">No players linked to this account yet.</div>
      ) : (
        children.map((child) => (
          <div key={child.id} className="mb-8 p-4 bg-gray-800 bg-opacity-80 rounded-lg">
            <h2 className="text-xl font-semibold mb-1">Player: {child.name}</h2>
            <p className="text-sm text-gray-400 mb-1">
              Level: {Math.floor(child.points / 1000) + 1} • Rank: {child.points >= 1000 ? 'Pro' : child.points >= 500 ? 'Rising Star' : 'Rookie'}
            </p>
            <p className="text-sm text-gray-400 italic mb-3">
              {workoutCounts[child.id] || 0} recent workout{workoutCounts[child.id] === 1 ? '' : 's'}
            </p>

            <div className="flex gap-2 mb-4 flex-wrap">
              {[1, 2, 5, 10].map((amount) => (
                <button
                  key={amount}
                  onClick={() => grantXP(child.id, amount * 100)}
                  className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 transition relative group"
                >
                  Grant £{amount} ({amount * 100} XP)
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100">
                    Give XP for unlocking kits or skills manually
                  </div>
                </button>
              ))}
            </div><div className="text-sm text-yellow-400 mt-2">
              🔓 Free account active — subscription unlocks access to all skill content. XP can always be granted and used to unlock individual skills or cosmetic gear.
              <button onClick={() => alert(`💡 XP vs Subscription:

• Subscription (£5/month) unlocks ALL skill content — ideal for regular progress.
• XP can be used to unlock specific skills manually, or to buy items like kits and boots in the Locker Room.

You can use both together, or choose what works best!`)}
                className='ml-2 underline text-blue-400 hover:text-blue-200 text-sm'>What’s the difference?</button>
            </div><button
              className={`mt-2 px-4 py-2 rounded ${subscribed[child.id] ? 'bg-green-600' : 'bg-gray-700'}`}
              onClick={() => toggleSubscription(child.id, subscribed[child.id])}
            >
              {subscribed[child.id] ? '✅ Subscribed (£5/month stub)' : 'Subscribe (£5/month stub)'}
            </button>

            <div className="mt-4">
              <h3 className="font-semibold text-lg mb-2">XP History</h3>
              <ul className="text-sm space-y-2">
                {requests
                  .filter((r) => r.child_id === child.id)
                  .map((r, idx) => (
                    <li key={idx} className="border-b border-gray-600 pb-1">
                      <strong>{r.requested_xp} XP</strong> — {r.message} (
                      <span
                        className={
                          r.status === 'approved'
                            ? 'text-green-400'
                            : r.status === 'denied'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }
                      >
                        {r.status}
                      </span>
                      ) —{' '}
                      <span className="text-gray-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
                    </div>
        ))
      )}
    </div>
    </>
  );
}