"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import NeonIconBar from "../../lobbycomponents/NeonIconBar";
import Link from "next/link";

/* ───────────────────────────── Page ───────────────────────────── */

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

  const [xpPercent, setXpPercent] = useState(0);
  const [selectedCard, setSelectedCard] = useState(null);

  const supabaseAvatarUrl = (url) =>
    !url
      ? null
      : url.startsWith("http")
      ? url
      : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${url}`;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("auth_id", user.id)
        .single();
      setPlayer(playerData || null);

      const { data: sessionsData } = await supabase
        .from("workout_sessions")
        .select("id, created_at, touches, work_time, skill_name, xr_awarded")
        .eq("player_id", playerData?.id);

      if (!sessionsData) return;

      setSessions(sessionsData.length);
      setWins(playerData?.games_won ?? 0);
      setGoals(playerData?.goals ?? 0);

      setXpData(groupSessionsByWeek(sessionsData, "xr_awarded"));
      setTouchesData(groupSessionsByWeek(sessionsData, "touches"));
      setTimeData(groupSessionsByWeek(sessionsData, "work_time"));

      // aggregate skills to seconds
      const skills = {};
      sessionsData.forEach(({ skill_name, work_time }) => {
        const names = normalizeSkillName(skill_name || "Unknown");
        names.forEach((n) => (skills[n] = (skills[n] || 0) + (work_time || 0)));
      });
      setSkillData(Object.entries(skills).map(([skill, seconds]) => ({ skill, seconds })));

      const { data: allPlayers } = await supabase.from("players").select("id, points");
      if (allPlayers && playerData) {
        const sorted = allPlayers.sort((a, b) => (b.points || 0) - (a.points || 0));
        const i = sorted.findIndex((p) => p.id === playerData.id);
        setRank(i >= 0 ? i + 1 : null);
      }

      const maxXP = 1000;
      setXpPercent(((playerData?.points ?? 0) / maxXP) * 100);
    })();
  }, []);

  return (
    <main
      className="h-[100svh] overflow-hidden flex flex-col p-2 md:p-3 text-white"
      style={{
        backgroundImage: "url('/characters/super_striker_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top bar */}
      <div className="flex-none sticky top-0 z-30 flex items-center justify-between bg-black/45 backdrop-blur-md p-2 md:p-2.5 border-b border-white/10 rounded-xl">
        <NeonIconBar />
        <div className="flex gap-2">
          <Link
            href="/trophy-cabinet"
            className="rounded-lg border border-yellow-400/40 bg-yellow-500/15 px-3 py-1.5 text-sm text-yellow-200 hover:bg-yellow-500/25"
          >
            Trophy Cabinet →
          </Link>
          <Link
            href="/lobby"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Home
          </Link>
        </div>
      </div>

      {/* Content: header + TWO rows of charts (fits in one screen) */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {/* Career header (slim) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative p-3 rounded-2xl border-4 border-yellow-300 shadow-xl overflow-hidden h-[120px]"
          style={{
            backgroundImage: player?.avatar_url ? `url('${supabaseAvatarUrl(player.avatar_url)}')` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="relative z-10 h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {player?.avatar_url && (
                <img
                  src={supabaseAvatarUrl(player.avatar_url)}
                  alt={player?.name || "Player"}
                  className="w-12 h-12 rounded-full border-4 border-yellow-400 shadow-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight drop-shadow">{player?.name || "Player"}</h1>
                <p className="text-[11px] text-gray-200 drop-shadow">HSC All Stars</p>
                <p className="text-[11px] text-yellow-300 drop-shadow">Global Rank #{rank}</p>
                <div className="mt-1.5 w-40 h-1.5 bg-black/40 rounded-full overflow-hidden border border-yellow-400">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 via-pink-400 to-yellow-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPercent}%` }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    style={{ boxShadow: "0 0 6px rgba(250,204,21,0.8)" }}
                  />
                </div>
                <p className="text-[10px] mt-0.5">{player?.points ?? 0} XP</p>
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-2 bg-black/50 px-2 py-1.5 rounded-xl border border-white/20 shrink-0 overflow-x-auto">
              <StatChip label="XP" value={player?.points ?? 0} icon="⚡" color="text-yellow-300" />
              <StatChip label="Sessions" value={sessions} icon="📅" color="text-green-300" />
              <StatChip label="Goals" value={goals} icon="🥅" color="text-pink-300" />
              <StatChip label="Wins" value={wins} icon="🏆" color="text-blue-300" />
            </div>
          </div>
        </motion.div>

        {/* ROW 1: XP / Touches (compact height) */}
        <div className="min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          <TinyLineCard title="XP Earned per Week" data={xpData} dataKey="xr_awarded" color="#facc15" suffix=" XP" height={120} />
          <TinyLineCard title="Touches per Week" data={touchesData} dataKey="touches" color="#fb7185" suffix="" height={120} />
        </div>

        {/* ROW 2: Training Time / Skill Overview (donut + top list) */}
        <div className="min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          <TinyLineCard title="Training Time per Week" data={timeData} dataKey="work_time" color="#60a5fa" suffix=" min" height={190} />
          <SkillOverviewCard data={skillData} height={190} />
        </div>
      </div>

      {/* (Optional) popup kept for continuity */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCard(null)}
          >
            <motion.img
              src={selectedCard.image}
              alt={selectedCard.name}
              className="max-w-xs w-full h-auto rounded-lg shadow-2xl border-4 border-yellow-300"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ────────────────────────── Small stat chip ────────────────────────── */

function StatChip({ label, value, color, icon }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl border border-white/20 shadow-lg backdrop-blur-md bg-white/10 p-1"
    >
      <div className="text-base leading-none">{icon}</div>
      <p className={`${color} text-sm font-extrabold leading-none`}>{value}</p>
      <p className="text-[9px] text-gray-300 uppercase tracking-wide text-center">{label}</p>
    </motion.div>
  );
}

/* ───────────────────────────── Helpers ───────────────────────────── */

function normalizeSkillName(raw) {
  if (!raw) return ["Unknown"];
  return raw
    .replace(/_/g, " ")
    .replace(/skill session/gi, "")
    .replace(/session_/gi, "")
    .replace(/test drill/gi, "")
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function secondsToHM(seconds) {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function groupSessionsByWeek(sessions, field) {
  const grouped = {};
  sessions.forEach((it) => {
    const d = new Date(it.created_at);
    const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
    const week = weekStart.toISOString().split("T")[0];
    grouped[week] = (grouped[week] || 0) + (it[field] || 0);
  });
  return Object.entries(grouped).map(([week, value]) => ({
    week,
    [field]: field === "work_time" ? Math.round(value / 60) : value,
  }));
}

/* ─────────────────── Tiny line card (height prop) ─────────────────── */

function TinyLineCard({ title, data, dataKey, color, suffix, height = 110 }) {
  return (
    <div className="bg-black/60 p-2.5 rounded-xl border border-white/10 shadow min-h-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-white mb-1">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" stroke="#ccc" tick={{ fontSize: 10 }} />
            <YAxis stroke="#ccc" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
              formatter={(v) => [`${v}${suffix || ""}`, ""]}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────── Skill Overview (donut + Top 10 list in one tile) ─────────── */

const PALETTE = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7", "#f97316", "#22d3ee", "#eab308", "#fb7185", "#84cc16"];

function useSkillRows(data, labelMax = 28) {
  return useMemo(() => {
    const map = new Map();
    (data || []).forEach((d) => {
      const name = (d.skill ?? "Unknown")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      const pretty = name.length > labelMax ? name.slice(0, labelMax) + "…" : name;
      const minutes = Math.max(0, Math.round((d.seconds ?? 0) / 60));
      map.set(pretty, (map.get(pretty) || 0) + minutes);
    });
    const rows = Array.from(map, ([name, minutes]) => ({ name, minutes }));
    rows.sort((a, b) => b.minutes - a.minutes);
    return rows;
  }, [data, labelMax]);
}

function SkillOverviewCard({ data, height = 190 }) {
  const rowsAll = useSkillRows(data, 28);
  const total = useMemo(() => rowsAll.reduce((s, r) => s + r.minutes, 0), [rowsAll]);
  const top = rowsAll.slice(0, 10);

  // donut source: top 6 + others
  const donutRows = useMemo(() => {
    const dTop = rowsAll.slice(0, 6);
    const rest = rowsAll.slice(6);
    const other = rest.reduce((s, r) => s + r.minutes, 0);
    return other ? [...dTop, { name: "Other", minutes: other }] : dTop;
  }, [rowsAll]);

  // color map by global order
  const colorMap = useMemo(() => {
    const m = new Map();
    rowsAll.forEach((r, i) => m.set(r.name, PALETTE[i % PALETTE.length]));
    m.set("Other", "#64748b");
    return m;
  }, [rowsAll]);

  return (
    <div className="bg-black/60 p-3 rounded-xl border border-white/10 shadow min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">Skill Overview</h3>
        <span className="text-[11px] text-slate-300/80">Total: <span className="font-medium">{total}m</span></span>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ height }}>
        {/* Donut (fills left half) */}
        <div className="min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutRows}
                dataKey="minutes"
                nameKey="name"
                innerRadius="55%"
                outerRadius="80%"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={1}
              >
                {donutRows.map((e) => (
                  <Cell key={e.name} fill={colorMap.get(e.name)} />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    const { cx, cy } = viewBox;
                    return (
                      <g>
                        <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize={12} opacity={0.9}>
                          Minutes
                        </text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={700}>
                          {total}
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${v} min`, n]}
                contentStyle={{
                  backgroundColor: "rgba(3, 7, 18, 0.95)",
                  border: "1px solid #243249",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top list (right half) */}
        <div className="min-h-0 overflow-auto pr-1">
          <ul className="text-xs space-y-1">
            {top.map((r, i) => {
              const pct = total ? Math.round((r.minutes / total) * 100) : 0;
              return (
                <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: colorMap.get(r.name) }}
                    />
                    <span className="text-white/90 truncate" title={r.name}>
                      {r.name}
                    </span>
                  </span>
                  <span className="text-white/85 tabular-nums">
                    {r.minutes}m • {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}