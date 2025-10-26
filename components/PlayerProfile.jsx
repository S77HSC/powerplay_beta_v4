// PlayerProfile.jsx
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
// OPTIONAL: only if you actually have this component
// import PlayerDashboard from "./PlayerDashboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

      const { data: sessionData = [] } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("player_id", playerId);

      setPlayer(playerData || null);
      setSessions(sessionData || []);

      const totalXP = (sessionData || []).reduce((sum, s) => sum + (s.xr_awarded || 0), 0);
      setXp(totalXP);
      setWorkouts(sessionData?.length || 0);

      const winCount = (sessionData || []).filter((s) => s.is_win).length;
      setWins(winCount);
    };

    if (playerId) fetchData();
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

    if (!groupedData[key]) groupedData[key] = { xp: 0, workouts: 0, touches: 0 };
    groupedData[key].xp += session.xr_awarded || 0;
    groupedData[key].workouts += 1;
    groupedData[key].touches += session.touches || 0;
  });

  const labels = Object.keys(groupedData);
  const xpValues = labels.map((k) => groupedData[k].xp);
  const workoutCounts = labels.map((k) => groupedData[k].workouts);
  const touchCounts = labels.map((k) => groupedData[k].touches); // ✅ fix

  const chartData = {
    labels,
    datasets: [
      { label: "XP Gained", data: xpValues, backgroundColor: "#facc15" },
      { label: "Workouts", data: workoutCounts, backgroundColor: "#4ade80" },
      { label: "Touches", data: touchCounts, backgroundColor: "#38bdf8" }, // ✅ now defined
    ],
  };

  return (
    <div style={{ background: "#0A0F24", color: "white", padding: "2rem", minHeight: "100vh" }}>
      {/* ...existing UI... */}
      {/* <PlayerDashboard player={player} sessions={sessions} /> */}
    </div>
  );
}
