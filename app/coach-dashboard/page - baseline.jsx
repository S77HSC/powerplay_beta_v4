// CoachDashboard.jsx — Full version with player stats, chart, and unlocked skill assignment
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';

export default function CoachDashboard() {
  const [userTeam, setUserTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [unlockedSkills, setUnlockedSkills] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
const { data: teamsData } = await supabase
        .from('coach_teams')
        .select('team_id')
        .eq('coach_auth_id', user.id);
      const teamList = (teamsData || []).map(t => t.team_id);
      setTeams(teamList);
      const defaultTeam = teamList[0];
      setUserTeam(defaultTeam);

      if (!coach || !coach.team) {
        setUserTeam(null);
        setLoading(false);
        return;
      }
      setUserTeam(coach.team);

      const { data: teamPlayers } = await supabase
        .from('players')
        .select('id, name, country, points, auth_id')
        .eq('team', coach.team);

      const { data: workoutSessions } = await supabase
        .from('workout_sessions')
        .select('player_id, completed_at, work_time')
        .in('player_id', teamPlayers.map(p => p.id));

      const { data: skills } = await supabase
        .from('unlocked_skills')
        .select('*');

      const skillMap = {};
for (const skill of skills || []) {
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
          workoutMeta[pid] = {
            count: 0,
            weekMins: 0,
            monthMins: 0,
            history: {},
          };
        }

        workoutMeta[pid].count++;
        if (completed.isAfter(now.subtract(7, 'day'))) {
          workoutMeta[pid].weekMins += session.work_time || 0;
        }
        if (completed.isAfter(now.subtract(30, 'day'))) {
          workoutMeta[pid].monthMins += session.work_time || 0;
        }
        if (!workoutMeta[pid].history[isoDate]) {
          workoutMeta[pid].history[isoDate] = 0;
        }
        workoutMeta[pid].history[isoDate]++;
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

      const { data: homeworkData } = await supabase
        .from('homework')
        .select('id, player_id, skill_id, assigned_at')
        .in('player_id', teamPlayers.map(p => p.id));
      setHomework(homeworkData || []);
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

  if (loading) return <p className="text-white p-4">Loading coach dashboard...</p>;
  if (!userTeam) return <p className="text-red-500 p-4">No team assigned. Please contact support.</p>;

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
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      <div className="w-64 bg-[#1e293b] p-6 space-y-6">
        <img src="/powerplay-logo.png" alt="Logo" className="w-32 mb-8 mx-auto" />
        <nav className="space-y-4">
          <button onClick={() => setActiveTab('dashboard')} className={`block text-left w-full ${activeTab === 'dashboard' ? 'text-white font-bold' : 'text-gray-300 hover:text-white'}`}>🏠 Dashboard</button>
          <button onClick={() => setActiveTab('players')} className={`block text-left w-full ${activeTab === 'players' ? 'text-white font-bold' : 'text-gray-300 hover:text-white'}`}>👥 Players</button>
          <button onClick={() => setActiveTab('homework')} className={`block text-left w-full ${activeTab === 'homework' ? 'text-white font-bold' : 'text-gray-300 hover:text-white'}`}>📚 Homework</button>
        </nav>
      </div>
      <div className="flex-1 p-10">
        <div className="mb-8">
          <label className="text-gray-400 text-sm">Select Team:</label>
          <select value={userTeam} onChange={e => setUserTeam(e.target.value)} className="ml-2 bg-gray-700 text-white p-1 rounded">
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        {activeTab === 'homework' && (
          <div className="mt-6">
            {players.map(player => {
              const playerHomework = homework.filter(h => h.player_id === player.id);
              return (
                <div key={player.id} className="mb-6">
                  <h3 className="text-md font-semibold mb-2">{player.name}</h3>
                  {playerHomework.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {playerHomework.map(hw => (
                        <li key={hw.id} className="bg-gray-700 px-3 py-2 rounded">
                          Skill: {hw.skill_id} — Assigned: {dayjs(hw.assigned_at).format('DD MMM YYYY')}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No homework assigned yet.</p>
                  )}
                </div>
              );
            })}
          </div>
          )}

        {activeTab === 'players' && (
          <div className="overflow-auto rounded-xl border border-gray-700 mb-10">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-left">Country</th>
                  <th className="px-4 py-2 text-left">XP</th>
                  <th className="px-4 py-2 text-left">Workouts</th>
                  <th className="px-4 py-2 text-left">Week</th>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-left">Unlocked Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {players.map(p => (
                  <tr key={p.id} className="hover:bg-gray-800">
                    <td className="px-4 py-2 font-semibold">
                      <a href={`/player-dashboard?auth=${p.auth_id}`} className="text-blue-400 hover:underline">{p.name}</a>
                    </td>
                    <td className="px-4 py-2">{p.country}</td>
                    <td className="px-4 py-2">{p.points}</td>
                    <td className="px-4 py-2">{p.workout_count}</td>
                    <td className="px-4 py-2">{p.week_mins}</td>
                    <td className="px-4 py-2">{p.month_mins}</td>
                    <td className="px-4 py-2">
                      <ul className="space-y-1">
                        {(unlockedSkills[p.id] || []).map(s => (
                          <li key={s.id} className="flex items-center justify-between bg-gray-700 px-2 py-1 rounded">
                            <span className="text-xs font-mono">{s.skill_id}</span>
                            <button
                              onClick={() => {
  if (!homework.some(h => h.player_id === p.id && h.skill_id === s.skill_id)) {
    assignWorkout(p.id, s.skill_id);
  }
}}
                              className={`ml-2 text-xs px-2 py-1 rounded ${homework.some(h => h.player_id === p.id && h.skill_id === s.skill_id) ? 'bg-green-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >📤</button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="bg-gray-800 p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4">📈 30-Day Activity Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                {players.map((p, idx) => (
                  <Line key={p.id} type="monotone" dataKey={p.name} stroke={`hsl(${(idx * 60) % 360}, 70%, 60%)`} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
