// app/coach-dashboard/CoachDashboardClient.jsx
'use client';

// CoachDashboard — Entry allowed with or without a team, with secure player linking
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // <- adjust if your alias isn't set
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';

export default function CoachDashboardClient() {
  const [userEmail, setUserEmail] = useState('');
  const [userTeam, setUserTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [unlockedSkills, setUnlockedSkills] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [linkCode, setLinkCode] = useState('');
  const [requestStatus, setRequestStatus] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
      } else {
        setUserEmail(user.email);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: teamsData } = await supabase
        .from('coach_teams')
        .select('team_id')
        .eq('coach_auth_id', user?.id);

      const teamList = (teamsData || []).map(t => t.team_id);
      setTeams(teamList);
      const defaultTeam = teamList[0] || '';
      setUserTeam(defaultTeam);

      if (!defaultTeam) {
        setLoading(false);
        return;
      }

      const { data: teamPlayers = [] } = await supabase
        .from('players')
        .select('id, name, country, points, auth_id')
        .eq('team', defaultTeam);

      const { data: workoutSessions = [] } = await supabase
        .from('workout_sessions')
        .select('player_id, completed_at, work_time')
        .in('player_id', teamPlayers.map(p => p.id));

      const { data: skills = [] } = await supabase
        .from('unlocked_skills')
        .select('*');

      const skillMap = {};
      for (const skill of skills) {
        const matchedPlayer = teamPlayers.find(p => p.auth_id === skill.players_id);
        if (!matchedPlayer) continue;
        if (!skillMap[matchedPlayer.id]) skillMap[matchedPlayer.id] = [];
        skillMap[matchedPlayer.id].push(skill);
      }
      setUnlockedSkills(skillMap);

      const now = dayjs();
      const workoutMeta = {};

      for (const session of workoutSessions) {
        const pid = session.player_id;
        const completed = dayjs(session.completed_at);
        const isoDate = completed.format('YYYY-MM-DD');

        if (!workoutMeta[pid]) {
          workoutMeta[pid] = { count: 0, weekMins: 0, monthMins: 0, history: {} };
        }

        workoutMeta[pid].count++;
        if (completed.isAfter(now.subtract(7, 'day'))) {
          workoutMeta[pid].weekMins += session.work_time || 0;
        }
        if (completed.isAfter(now.subtract(30, 'day'))) {
          workoutMeta[pid].monthMins += session.work_time || 0;
        }
        workoutMeta[pid].history[isoDate] = (workoutMeta[pid].history[isoDate] || 0) + 1;
      }

      const enrichedPlayers = teamPlayers.map(p => {
        const raw = workoutMeta[p.id]?.history || {};
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = dayjs().subtract(29 - i, 'day');
          const iso = date.format('YYYY-MM-DD');
          return { date: iso, count: raw[iso] || 0 };
        });

        return {
          ...p,
          workout_count: workoutMeta[p.id]?.count || 0,
          week_mins: workoutMeta[p.id]?.weekMins || 0,
          month_mins: workoutMeta[p.id]?.monthMins || 0,
          history: last30Days,
        };
      });

      setPlayers(enrichedPlayers);

      const { data: homeworkData = [] } = await supabase
        .from('homework')
        .select('id, player_id, skill_id, assigned_at')
        .in('player_id', teamPlayers.map(p => p.id));

      setHomework(homeworkData);
      setLoading(false);
    };

    fetchData();
  }, []);

  const assignWorkout = async (playerId, skillId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newHomework = {
      player_id: playerId,
      skill_id: skillId,
      assigned_at: dayjs().toISOString(),
      created_by: user.id,
    };
    const { error } = await supabase.from('homework').insert([newHomework]);
    if (error) {
      setStatus(`❌ Error assigning homework: ${error.message}`);
    } else {
      setStatus('✅ Homework assigned!');
      setHomework(prev => [...prev, { ...newHomework, id: Date.now(), player_id: playerId }]);
    }
  };

  const submitPlayerRequest = async () => {
    setRequestStatus('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('coach_requests').insert([{
      coach_id: user.id,
      code: linkCode,
      status: 'pending',
      requested_at: new Date().toISOString(),
    }]);
    if (error) {
      setRequestStatus(`❌ ${error.message}`);
    } else {
      setRequestStatus('✅ Request submitted! Awaiting parent approval.');
      setLinkCode('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white mx-auto mb-4" />
          Loading coach dashboard...
        </div>
      </div>
    );
  }

  const dateLabels = players[0]?.history.map(h => h.date) || [];
  const chartData = dateLabels.map(date => {
    const obj = { date };
    players.forEach(p => {
      const day = p.history.find(h => h.date === date);
      obj[p.name] = day ? day.count : 0;
    });
    return obj;
  });

  return (
    <>
      <div
        className="absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}
      />
      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <img src="/powerplay-logo.png" alt="Logo" className="h-16 w-auto drop-shadow-lg" />
              <div>
                <h1 className="text-3xl font-bold">Coach Dashboard</h1>
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

          <div className="flex space-x-4 mb-6">
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded ${activeTab === 'dashboard' ? 'bg-blue-600' : 'bg-gray-700'}`}>Dashboard</button>
            <button onClick={() => setActiveTab('request')} className={`px-4 py-2 rounded ${activeTab === 'request' ? 'bg-blue-600' : 'bg-gray-700'}`}>Request Player</button>
          </div>

          {status && (
            <div className="mb-4 p-2 rounded text-sm" style={{ backgroundColor: status.startsWith('✅') ? '#14532d' : '#7f1d1d' }}>
              {status}
            </div>
          )}

          {activeTab === 'dashboard' && players.length > 0 && (
            <div className="bg-gray-800 p-6 rounded-xl">
              <h2 className="text-lg font-semibold mb-4">📈 30-Day Activity Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  {players.map((p, idx) => (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={p.name}
                      stroke={`hsl(${(idx * 60) % 360}, 70%, 60%)`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'request' && (
            <div className="bg-gray-800 p-6 rounded-xl">
              <h2 className="text-lg font-semibold mb-4">🔐 Request to Link a Player</h2>
              <p className="text-sm text-gray-300 mb-2">Ask a parent for a unique player code and enter it below:</p>
              <input
                type="text"
                value={linkCode}
                onChange={e => setLinkCode(e.target.value)}
                placeholder="e.g. P4Y-Q8Z-JXN"
                className="bg-gray-700 text-white px-4 py-2 rounded w-full mb-2"
              />
              <button onClick={submitPlayerRequest} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                Submit Request
              </button>
              {requestStatus && <div className="mt-3 text-sm">{requestStatus}</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
