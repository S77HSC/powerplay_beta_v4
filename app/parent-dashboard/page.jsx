// app/parent-dashboard/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Parent Dashboard (co-located components)
 * - Shows linked children
 * - XP grants + history
 * - Subscription toggle (stub)
 * - Coach request approvals
 * - Player code generation
 * - NEW: Chat Approvals (per child) to allow/block DMs with specific friends
 */

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [requests, setRequests] = useState([]);
  const [subscribed, setSubscribed] = useState({});
  const [workoutCounts, setWorkoutCounts] = useState({});
  const [coachRequests, setCoachRequests] = useState({});
  const [playerCodes, setPlayerCodes] = useState({});

  useEffect(() => {
    const fetchChildren = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email);

      // 1) Which players belong to this parent?
      const { data: links } = await supabase
        .from('parent_links')
        .select('child_id')
        .eq('parent_email', user.email)
        .eq('status', 'approved');

      const childIds = (links || []).map(l => l.child_id).filter(Boolean);
      if (childIds.length === 0) {
        setChildren([]);
        return;
      }

      // 2) Load basic player info
      const { data: playerData } = await supabase
        .from('players')
        .select('id, name, subscription_active, points')
        .in('id', childIds);

      setChildren(playerData || []);

      // 3) XP history shown in UI
      const { data: xpData } = await supabase
        .from('xp_requests')
        .select('*')
        .in('child_id', childIds);

      setRequests(xpData || []);

      // 4) Player codes (for coach requests)
      const { data: codesData } = await supabase
        .from('player_codes')
        .select('*')
        .in('player_id', childIds)
        .eq('used', false);

      const codeMap = {};
      const groupedCodes = {};
      (codesData || []).forEach(code => {
        const normCode = code.code.replace(/-/g, '').toUpperCase();
        codeMap[normCode] = code.player_id;
        groupedCodes[code.player_id] = code.code;
      });
      setPlayerCodes(groupedCodes);

      // 5) Coach requests → group by child via player_codes
      const { data: pendingCoachReqs } = await supabase
        .from('coach_requests')
        .select('*')
        .eq('status', 'pending');

      const requestsByPlayer = {};
      (pendingCoachReqs || []).forEach(req => {
        const normalized = (req.code || '').replace(/-/g, '').toUpperCase();
        const playerId = codeMap[normalized];
        if (childIds.includes(playerId)) {
          if (!requestsByPlayer[playerId]) requestsByPlayer[playerId] = [];
          requestsByPlayer[playerId].push(req);
        }
      });
      setCoachRequests(requestsByPlayer);

      // 6) Subscriptions + workout counts
      const initialSubs = {};
      const workoutsByChild = {};
      for (const child of playerData || []) {
        initialSubs[child.id] = !!child.subscription_active;

        const { data: workouts } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('player_id', child.id);

        workoutsByChild[child.id] = (workouts || []).length;
      }
      setSubscribed(initialSubs);
      setWorkoutCounts(workoutsByChild);
    };

    fetchChildren();
  }, []);

  // --- Actions ---
  const grantXP = async (childId, xp) => {
    const message = `Parent granted ${xp} XP`;
    await supabase
      .from('xp_requests')
      .insert({ child_id: childId, requested_xp: xp, status: 'approved', message });

    setRequests(prev => [
      ...prev,
      { child_id: childId, requested_xp: xp, status: 'approved', message, created_at: new Date().toISOString() },
    ]);
  };

  const toggleSubscription = async (childId, isActive) => {
    await supabase.from('players').update({ subscription_active: !isActive }).eq('id', childId);
    setSubscribed(prev => ({ ...prev, [childId]: !isActive }));
  };

  const respondToCoachRequest = async (id, playerId, decision) => {
    const status = decision === 'approve' ? 'approved' : 'denied';
    const updates = {
      status,
      responded_at: new Date().toISOString(),
      ...(status === 'approved' ? { player_id: playerId } : {}),
    };

    const { error } = await supabase.from('coach_requests').update(updates).eq('id', id);
    if (!error) {
      setCoachRequests(prev => {
        const updated = { ...prev };
        updated[playerId] = (updated[playerId] || []).filter(r => r.id !== id);
        if (updated[playerId]?.length === 0) delete updated[playerId];
        return updated;
      });
    }
  };

  const generatePlayerCode = async (playerId) => {
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase
      .from('player_codes')
      .insert({ player_id: playerId, code: randomCode });
    if (!error) {
      setPlayerCodes(prev => ({ ...prev, [playerId]: randomCode }));
    }
  };

  return (
    <>
      <div
        className="absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}
      />
      <div className="max-w-4xl mx-auto p-4 text-white relative z-10">
        {/* Header */}
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

        {/* Content */}
        {children.length === 0 ? (
          <div className="text-yellow-400">No players linked to this account yet.</div>
        ) : (
          children.map((child) => (
            <div key={child.id} className="mb-8 p-4 bg-gray-800 bg-opacity-80 rounded-lg">
              {/* Player header */}
              <h2 className="text-xl font-semibold mb-1">Player: {child.name}</h2>
              <p className="text-sm text-gray-400 mb-1">
                Level: {Math.floor(child.points / 1000) + 1} • Rank: {child.points >= 1000 ? 'Pro' : child.points >= 500 ? 'Rising Star' : 'Rookie'}
              </p>
              <p className="text-sm text-gray-400 italic mb-3">
                {workoutCounts[child.id] || 0} recent workout{workoutCounts[child.id] === 1 ? '' : 's'}
              </p>

              {/* Quick XP buttons */}
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
              </div>

              {/* Subscription stub + explainer */}
              <div className="text-sm text-yellow-400 mt-2">
                🔓 Free account active — subscription unlocks access to all skill content. XP can always be granted and used to unlock individual skills or cosmetic gear.
                <button
                  onClick={() =>
                    alert(
                      `💡 XP vs Subscription:\n\n• Subscription (£5/month) unlocks ALL skill content — ideal for regular progress.\n• XP can be used to unlock specific skills manually, or to buy items like kits and boots in the Locker Room.\n\nYou can use both together, or choose what works best!`
                    )
                  }
                  className="ml-2 underline text-blue-400 hover:text-blue-200 text-sm"
                >
                  What’s the difference?
                </button>
              </div>

              <button
                className={`mt-2 px-4 py-2 rounded ${subscribed[child.id] ? 'bg-green-600' : 'bg-gray-700'}`}
                onClick={() => toggleSubscription(child.id, subscribed[child.id])}
              >
                {subscribed[child.id] ? '✅ Subscribed (£5/month stub)' : 'Subscribe (£5/month stub)'}
              </button>

              {/* XP history */}
              <div className="mt-4">
                <h3 className="font-semibold text-lg mb-2">XP History</h3>
                <ul className="text-sm space-y-2">
                  {requests
                    .filter(r => r.child_id === child.id)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((r, idx) => (
                      <li key={idx} className="border-b border-gray-600 pb-1">
                        <strong>{r.requested_xp} XP</strong> — {r.message}{' '}
                        (<span
                          className={
                            r.status === 'approved'
                              ? 'text-green-400'
                              : r.status === 'denied'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }
                        >
                          {r.status}
                        </span>) —{' '}
                        <span className="text-gray-400">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Coach code + requests */}
              <div className="mt-4">
                <p className="text-sm">
                  Coach Code: <code>{playerCodes[child.id] || '—'}</code>
                </p>
                <button
                  onClick={() => generatePlayerCode(child.id)}
                  className="bg-blue-600 px-3 py-1 rounded text-sm mt-1"
                >
                  🔄 Regenerate Coach Code
                </button>
              </div>

              {coachRequests[child.id]?.length > 0 && (
                <div className="bg-gray-700 p-3 rounded mt-3">
                  <p className="text-sm mb-2">📥 Coach requests received for this player:</p>
                  {coachRequests[child.id].map((req) => (
                    <div key={req.id} className="mb-2">
                      <p className="text-sm">Code: <code>{req.code}</code></p>
                      <button
                        onClick={() => respondToCoachRequest(req.id, child.id, 'approve')}
                        className="bg-green-600 px-3 py-1 rounded mr-2 text-sm"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => respondToCoachRequest(req.id, null, 'deny')}
                        className="bg-red-600 px-3 py-1 rounded text-sm"
                      >
                        ❌ Deny
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* NEW: Chat Approvals */}
              <div className="mt-6 bg-gray-700 p-3 rounded">
                <h3 className="text-lg font-semibold mb-2">💬 Chat Approvals</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Approve or block who {child.name} can message.
                </p>
                <ChatApprovals childId={child.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* -------------------------------------------
   Co-located component: ChatApprovals
   - Finds the child's auth user_id
   - Lists accepted friendships for that user
   - Lets the parent toggle parent_approved
-------------------------------------------- */
function ChatApprovals({ childId }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      setErrorMsg('');
      // 1) try players.user_id first
      let childUserId = null;
      let player = null;

      const { data: playerRow } = await supabase
        .from('players')
        .select('id, user_id')
        .eq('id', childId)
        .single();

      player = playerRow || null;
      if (player?.user_id) {
        childUserId = player.user_id;
      } else {
        // fallback: player_user_map (if used in your schema)
        const { data: mapRow } = await supabase
          .from('player_user_map')
          .select('user_id')
          .eq('player_id', childId)
          .single();
        childUserId = mapRow?.user_id || null;
      }

      if (!childUserId) {
        setRows([]);
        setErrorMsg('This player is not linked to an account yet.');
        return;
      }

      // 2) all accepted friends for that user (either direction)
      const { data: friends, error: fErr } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, parent_approved, parent_approved_at, status')
        .or(`user_id.eq.${childUserId},friend_id.eq.${childUserId}`)
        .eq('status', 'accepted');

      if (fErr) {
        setErrorMsg('Could not load friends.');
        return;
      }
      if (!friends?.length) {
        setRows([]);
        return;
      }

      const otherIds = friends.map(f => (f.user_id === childUserId ? f.friend_id : f.user_id));

      // 3) fetch display info
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', otherIds);

      const getOtherId = (f) => (f.user_id === childUserId ? f.friend_id : f.user_id);
      const joined = friends.map(f => ({
        ...f,
        other_id: getOtherId(f),
        other: (profiles || []).find(p => p.id === getOtherId(f)) || { id: getOtherId(f) },
      }));

      // sort: unapproved first, then name
      joined.sort((a, b) => {
        if (a.parent_approved === b.parent_approved) {
          const an = (a.other?.username || '').toLowerCase();
          const bn = (b.other?.username || '').toLowerCase();
          return an.localeCompare(bn);
        }
        return a.parent_approved ? 1 : -1;
      });

      setRows(joined);
    })();
  }, [childId]);

  const toggle = async (row) => {
    setBusy(true);
    setErrorMsg('');
    const next = !row.parent_approved;

    const { error } = await supabase
      .from('friends')
      .update({ parent_approved: next, parent_approved_at: new Date().toISOString() })
      .eq('id', row.id);

    if (error) {
      setErrorMsg('Update blocked. Make sure your RLS policy allows parents to change approvals.');
    } else {
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, parent_approved: next } : r)));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}
      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm">No accepted friends yet for this player.</p>
      ) : (
        rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
            <div className="flex items-center gap-3">
              {r.other?.avatar_url
                ? <img src={r.other.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                : <div className="w-8 h-8 bg-gray-600 rounded-full" />}
              <div className="text-sm">
                <div className="font-medium">{r.other?.username || r.other_id}</div>
                <div className="text-xs text-gray-400">
                  {r.parent_approved ? 'Approved to chat' : 'Blocked from chatting'}
                  {r.parent_approved_at && (
                    <span className="ml-2 opacity-70">
                      (since {new Date(r.parent_approved_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              disabled={busy}
              onClick={() => toggle(r)}
              className={`text-sm px-3 py-1 rounded ${r.parent_approved ? 'bg-green-600' : 'bg-red-600'}`}
              title={r.parent_approved ? 'Click to revoke' : 'Click to approve'}
            >
              {r.parent_approved ? '✅ Approved' : '❌ Blocked'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
