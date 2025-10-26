"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function PlayerProfile() {
  const params = useParams();
  const playerId = params?.id;
  const [player, setPlayer] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [xp, setXp] = useState(0);
  const [workouts, setWorkouts] = useState(0);
  const [wins, setWins] = useState(0);
  const [selectedRange, setSelectedRange] = useState("Weekly");

  useEffect(() => {
    const fetchData = async () => {
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .single();

      const { data: sessionData } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("player_id", playerId);

      setPlayer(playerData);
      setSessions(sessionData);

      const totalXP = sessionData.reduce((sum, s) => sum + (s.xr_awarded || 0), 0);
      setXp(totalXP);
      setWorkouts(sessionData.length);

      const winCount = sessionData.filter(s => s.is_win).length;
      setWins(winCount);
    };

    if (playerId) {
      fetchData();
    }
  }, [playerId]);

  const groupedData = {};
  sessions.forEach((session) => {
    const date = new Date(session.completed_at);
    let key;

    if (selectedRange === "Monthly") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    } else if (selectedRange === "Daily") {
      key = date.toISOString().split("T")[0];
    } else {
      const firstDayOfWeek = new Date(date);
      firstDayOfWeek.setDate(date.getDate() - date.getDay());
      key = firstDayOfWeek.toISOString().split("T")[0];
    }

    if (!groupedData[key]) {
      groupedData[key] = { xp: 0, workouts: 0 };
    }

    groupedData[key].xp += session.xr_awarded || 0;
    groupedData[key].workouts += 1;
  });

  const labels = Object.keys(groupedData);
  const xpValues = labels.map((key) => groupedData[key].xp);
  const workoutCounts = labels.map((key) => groupedData[key].workouts);

  const chartData = {
    labels,
    datasets: [
      {
        label: "XP Gained",
        data: xpValues,
        backgroundColor: "#facc15",
      },
      {
        label: "Workouts",
        data: workoutCounts,
        backgroundColor: "#4ade80",
      },
    ],
  };

  return (
    <div style={{ background: "#0A0F24", color: "white", padding: "2rem", minHeight: "100vh" }}>
      {player && (
        <div style={{ textAlign: "center" }}>
          <img
            src={player.avatar_url?.startsWith("http") ? player.avatar_url : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`}
            alt="avatar"
            style={{ width: 100, height: 100, borderRadius: "50%", border: "2px solid #00b4d8", marginBottom: "1rem" }}
          />
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#38bdf8" }}>{player.name}</h1>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8" }}>{player.team}</p>
          <div style={{ marginTop: "0.5rem" }}>
            <img
              src={`https://flagcdn.com/w40/${player.country?.toLowerCase() || "gb"}.png`}
              alt={player.country}
              style={{ height: "30px", borderRadius: "4px" }}
            />
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            <span style={{ fontSize: "1rem", backgroundColor: "#22c55e", padding: "0.5rem 1rem", borderRadius: "999px" }}>
              🏆 {wins} Wins
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
          <button onClick={() => setSelectedRange("Daily")} style={buttonStyle(selectedRange === "Daily" ? "#2563eb" : "#4b5563")}>Daily</button>
          <button onClick={() => setSelectedRange("Weekly")} style={buttonStyle(selectedRange === "Weekly" ? "#2563eb" : "#4b5563")}>Weekly</button>
          <button onClick={() => setSelectedRange("Monthly")} style={buttonStyle(selectedRange === "Monthly" ? "#2563eb" : "#4b5563")}>Monthly</button>
        </div>

        <div style={{ background: "#1f2937", padding: "1rem", borderRadius: "8px" }}>
          <Bar data={chartData} />
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <a href="/skill-session" style={{ backgroundColor: "#38bdf8", color: "#0f172a", padding: "0.75rem 1.5rem", borderRadius: "12px", fontWeight: "bold", textDecoration: "none" }}>
          🚀 Start Next Session
        </a>
      </div>
    </div>
  );
}

const buttonStyle = (bg) => ({
  padding: "0.5rem 1rem",
  backgroundColor: bg,
  border: "none",
  color: "white",
  borderRadius: "6px",
  cursor: "pointer",
});
