"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LabelList
} from 'recharts';

const SKILL_NAME_MAP = {
  "toetaps": "Skill 1 - Toe Taps",
  "toe taps": "Skill 1 - Toe Taps",
  "ticktocks": "Skill 2 - Ticktocks",
  "ticktockstops": "Skill 3 - Tick Tock Stops",
  "ticktocksoleroll": "Skill 5 - Tick Tock Sole Roll",
  "ticktockoutsidein": "Skill 6 - Tick Tock Outside In",
  "outside take stop": "Skill 4 - Outside Take Stop",
  "outsidetakestop": "Skill 4 - Outside Take Stop",
};

function normalizeSkillName(raw) {
  if (!raw) return "Unknown";
  return raw
    .toLowerCase()
    .split(',')
    .map(part => {
      for (const [key, value] of Object.entries(SKILL_NAME_MAP)) {
        if (part.includes(key)) return value;
      }
      return "Other";
    })
    .filter(Boolean);
}

function secondsToHM(seconds) {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function groupSessionsByWeek(sessions, field) {
  const grouped = {};
  sessions.forEach(item => {
    const date = new Date(item.created_at);
    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
    const week = weekStart.toISOString().split("T")[0];
    if (!grouped[week]) grouped[week] = 0;
    grouped[week] += item[field] || 0;
  });
  return Object.entries(grouped).map(([week, value]) => ({
    week,
    [field]: field === 'work_time' ? Math.round(value / 60) : value
  }));
}

function groupSessionsByDay(sessions, field) {
  const grouped = {};
  sessions.forEach(item => {
    const dateKey = new Date(item.created_at).toISOString().split("T")[0];
    if (!grouped[dateKey]) grouped[dateKey] = 0;
    grouped[dateKey] += item[field] || 0;
  });
  return Object.entries(grouped).map(([day, value]) => ({
    day,
    [field]: field === 'work_time' ? Math.round(value / 60) : value
  }));
}

export default function PlayerDashboard() {
  const [player, setPlayer] = useState(null);
  const [rank, setRank] = useState(null);
  const [sessions, setSessions] = useState(0);
  const [wins, setWins] = useState(0);
  const [goals, setGoals] = useState(0);
  const [xpData, setXpData] = useState([]);
  const [touchesData, setTouchesData] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [skillData, setSkillData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase.from('players').select('*').eq('auth_id', user.id).single();
      setPlayer(playerData);

      const { data: sessionsData } = await supabase
        .from('workout_sessions')
        .select('id, created_at, touches, work_time, skill_name, xr_awarded')
        .eq('player_id', playerData.id);

      if (!sessionsData) return;

      setSessions(sessionsData.length);
      setWins(playerData.games_won ?? 0);
      setGoals(playerData.goals ?? 0);
      setXpData(groupSessionsByWeek(sessionsData, 'xr_awarded'));
      setTouchesData(groupSessionsByWeek(sessionsData, 'touches'));
      setTimeData(groupSessionsByWeek(sessionsData, 'work_time'));
      setDailyData(groupSessionsByDay(sessionsData, 'work_time'));

      const skills = {};
      sessionsData.forEach(({ skill_name, work_time }) => {
        const names = normalizeSkillName(skill_name || 'Unknown');
        names.forEach(name => {
          skills[name] = (skills[name] || 0) + (work_time || 0);
        });
      });
      setSkillData(Object.entries(skills).map(([skill, seconds]) => ({
        skill,
        seconds,
        label: secondsToHM(seconds)
      })));

      const { data: allPlayers } = await supabase.from('players').select('id, points');
      if (allPlayers) {
        const sorted = allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
        const position = sorted.findIndex(p => p.id === playerData.id);
        setRank(position >= 0 ? position + 1 : null);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19] text-white px-4 py-10 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none" style={{ backgroundImage: "url('/images/futuristic-football-bg.jpg')" }}></div>
      <div className="relative z-10 max-w-7xl mx-auto space-y-10">

        <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl shadow-lg border border-white/10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6">
          <div className="flex items-center gap-4">
            {player?.avatar_url && (
              <Image
                src={player.avatar_url.startsWith('http') ? player.avatar_url : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`}
                alt="Avatar"
                width={80}
                height={80}
                className="rounded-full border-2 border-white/30 w-[80px] h-[80px] object-cover"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-cyan-300">{player?.name}</h2>
              <p className="text-sm text-gray-400">HSC All Stars</p>
              <p className="text-xs text-sky-400 mt-1">Global Rank #{rank}</p>
              <div className="w-full max-w-xs mt-2">
                <div className="h-2 rounded-full bg-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full animate-pulse"
                    style={{ width: `${Math.min(((player?.points ?? 0) % 1000) / 10, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 text-right mt-1">{player?.points ?? 0} XP</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
            <StatCard label="XP" value={player?.points ?? 0} color="text-yellow-300" icon="⚡" />
            <StatCard label="Sessions" value={sessions} color="text-green-300" icon="📅" />
            <StatCard label="Goals" value={goals} color="text-pink-300" icon="🥅" />
            <StatCard label="Wins" value={wins} color="text-blue-300" icon="🏆" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="XP Earned per Week" data={xpData} dataKey="xr_awarded" color="#facc15" suffix=" XP" />
          <ChartCard title="Touches per Week" data={touchesData} dataKey="touches" color="#fb7185" suffix=" Touches" />
          <ChartCard title="Training Time per Week" data={timeData} dataKey="work_time" color="#60a5fa" suffix=" min" />
          <SkillBarChart data={skillData} />
        </div>

        <div className="bg-white/5 p-6 rounded-xl border border-white/10 shadow">
          <h3 className="text-lg font-semibold text-white mb-4">📅 Daily Activity Summary</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#ccc" angle={-30} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#ccc" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(value) => [`${value} min`, 'Training']}
              />
              <Bar dataKey="work_time" fill="#38bdf8" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="flex flex-col items-center bg-black/10 rounded-lg px-4 py-2 border border-white/10">
      <div className="text-xl mb-1">{icon}</div>
      <p className={`${color} text-lg font-bold`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function ChartCard({ title, data, dataKey, color, suffix }) {
  return (
    <div className="bg-white/5 p-5 rounded-xl border border-white/10 shadow">
      <h3 className="text-md font-semibold text-white mb-1">{title}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" stroke="#ccc" angle={-30} textAnchor="end" height={60} interval={0} />
          <YAxis stroke="#ccc" />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#38bdf8" }}
            formatter={(value) => [`${value}${suffix || ''}`, '']}
          />
          <Legend />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SkillBarChart({ data }) {
  return (
    <div className="bg-white/5 p-5 rounded-xl border border-white/10 shadow overflow-x-auto">
      <h3 className="text-md font-semibold text-white mb-2">Time per Skill</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart layout="vertical" data={data} margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" stroke="#ccc" />
          <YAxis type="category" dataKey="skill" stroke="#ccc" width={200} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            formatter={(value) => [secondsToHM(value), 'Time']}
          />
          <Bar dataKey="seconds" fill="#a78bfa" barSize={14}>
            <LabelList dataKey="label" position="right" fill="#fff" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles = `
@media (max-width: 768px) {
  .recharts-wrapper {
    width: 100% !important;
  }
  .recharts-yAxis .recharts-cartesian-axis-tick text,
  .recharts-xAxis .recharts-cartesian-axis-tick text {
    font-size: 10px;
  }
  .recharts-xAxis .recharts-cartesian-axis-tick text {
    transform: rotate(-30deg);
    text-anchor: end;
  }
  .recharts-tooltip-wrapper {
    font-size: 12px;
  }
  .text-md {
    font-size: 0.875rem;
  }
  .text-lg {
    font-size: 1rem;
  }
  .text-xl {
    font-size: 1.25rem;
  }
}`;

if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);
}

function DailyBarChart({ data }) {
  return (
    <div className="bg-white/5 p-6 rounded-xl border border-white/10 shadow">
      <h3 className="text-lg font-semibold text-white mb-4">📅 Daily Activity Summary</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#ccc" angle={-30} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10 }} />
          <YAxis stroke="#ccc" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            formatter={(value) => [`${value} min`, 'Training']}
          />
          <Bar dataKey="work_time" fill="#38bdf8" barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}