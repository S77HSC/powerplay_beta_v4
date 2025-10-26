
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SacrificeGame() {
  const [introShown, setIntroShown] = useState(true);
  const [teamSize, setTeamSize] = useState(3);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [log, setLog] = useState([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [matchTime, setMatchTime] = useState(300);
  const [timer, setTimer] = useState(300);
  const [matchRunning, setMatchRunning] = useState(false);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");

  useEffect(() => {
    if (playerSearch.length >= 2) {
      fetchPlayers(playerSearch);
    } else {
      setSearchResults([]);
    }
  }, [playerSearch]);

  const fetchPlayers = async (query) => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .ilike("name", `%${query}%`);
    if (!error) setSearchResults(data);
  };

  const assignPlayer = (player, team) => {
    const exists = (team === "A" ? teamA : teamB).some((p) => p.id === player.id);
    if (exists) return;
    if (team === "A" && teamA.length < teamSize) setTeamA([...teamA, player]);
    if (team === "B" && teamB.length < teamSize) setTeamB([...teamB, player]);
  };

  const sacrificePlayer = (teamList, setTeam) => {
    if (teamList.length <= 1) return null;
    const index = Math.floor(Math.random() * teamList.length);
    const removed = teamList[index];
    setTeam(teamList.filter((_, i) => i !== index));
    return removed;
  };

  const addGoal = async (player, team) => {
    const name = player.name;
    if (team === "A") {
      setScoreA((prev) => prev + 1);
      setLog((prev) => [...prev, `⚽ ${name} scored for ${teamAName}`]);
      const removed = sacrificePlayer(teamA, setTeamA);
      if (removed) setLog((prev) => [...prev, `🔥 ${removed.name} was sacrificed from ${teamAName}`]);
    } else {
      setScoreB((prev) => prev + 1);
      setLog((prev) => [...prev, `⚽ ${name} scored for ${teamBName}`]);
      const removed = sacrificePlayer(teamB, setTeamB);
      if (removed) setLog((prev) => [...prev, `🔥 ${removed.name} was sacrificed from ${teamBName}`]);
    }
    await supabase.from("players").update({ points: player.points + 10 }).eq("id", player.id);
  };

  const awardWinXP = async (teamList) => {
    for (let p of teamList) {
      await supabase.from("players").update({ points: p.points + 50 }).eq("id", p.id);
    }
  };

  const saveGame = async () => {
    const winner = scoreA > scoreB ? teamAName : scoreB > scoreA ? teamBName : null;
    if (winner === teamAName) await awardWinXP(teamA);
    else if (winner === teamBName) await awardWinXP(teamB);
    setLog((prev) => [...prev, "💾 Game saved. XP awarded."]);
    alert("Game saved & XP awarded!");
  };

  useEffect(() => {
    let interval = null;
    if (matchRunning && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0 && matchRunning) {
      setMatchRunning(false);
    }
    return () => clearInterval(interval);
  }, [matchRunning, timer]);

  const formatTime = (t) => `${Math.floor(t / 60)}:${t % 60 < 10 ? "0" : ""}${t % 60}`;

  return (
    <div className="relative max-w-5xl mx-auto p-4 text-white bg-gray-900 min-h-screen">
      {introShown && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col justify-center items-center animate-fadeIn">
          <img src="/sacrifice_logo.png" alt="SACRIFICE Logo" className="h-40 mb-4 animate-scaleIn" />
          <h1 className="text-5xl font-bold mb-2">SACRIFICE</h1>
          <p className="text-lg italic text-gray-300 mb-6">The strongest team will survive.</p>
          <button onClick={() => setIntroShown(false)} className="btn bg-green-600 animate-pulse text-white px-6 py-2 rounded">Start Match</button>
        </div>
      )}

      {/* The rest of the game will load below after intro is dismissed */}
      {!introShown && (
        <div>
          {/* Add game UI components here like team size, timers, team controls, etc. */}
          <p className="text-center">🎮 Match UI goes here…</p>
        </div>
      )}

      <style jsx>{`
        .btn {
          background-color: #2563eb;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }
        .animate-fadeIn {
          animation: fadeIn 1s ease forwards;
        }
        .animate-scaleIn {
          animation: scaleIn 0.8s ease forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
