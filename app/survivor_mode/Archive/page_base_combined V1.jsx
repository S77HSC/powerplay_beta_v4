"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function SacrificeGame() {
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
    if (playerSearch.length >= 2) fetchPlayers(playerSearch);
    else setSearchResults([]);
  }, [playerSearch]);

  const fetchPlayers = async (query) => {
    const { data, error } = await supabase.from("players").select("*").ilike("name", `%${query}%`);
    if (!error) setSearchResults(data);
  };

  const assignPlayer = (player, team) => {
    const exists = (team === "A" ? teamA : teamB).some(p => p.id === player.id);
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
      setScoreA(prev => prev + 1);
      setLog(prev => [...prev, `⚽ ${name} scored for ${teamAName}`]);
      const removed = sacrificePlayer(teamA, setTeamA);
      if (removed) setLog(prev => [...prev, `🔥 ${removed.name} was sacrificed from ${teamAName}`]);
    } else {
      setScoreB(prev => prev + 1);
      setLog(prev => [...prev, `⚽ ${name} scored for ${teamBName}`]);
      const removed = sacrificePlayer(teamB, setTeamB);
      if (removed) setLog(prev => [...prev, `🔥 ${removed.name} was sacrificed from ${teamBName}`]);
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
    setLog(prev => [...prev, "💾 Game saved. XP awarded."]);
    alert("Game saved & XP awarded!");
  };

  useEffect(() => {
    let interval = null;
    if (matchRunning && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && matchRunning) {
      setMatchRunning(false);
    }
    return () => clearInterval(interval);
  }, [matchRunning, timer]);

  const formatTime = (t) => `${Math.floor(t / 60)}:${t % 60 < 10 ? "0" : ""}${t % 60}`;

  return (
    <div className="max-w-5xl mx-auto p-4 text-white bg-gray-900 min-h-screen">
      {/* Team Size - Top */}
      <div className="text-center mb-4">
        <label className="mr-2 font-semibold">Team Size:</label>
        {[3, 5, 7].map(size => (
          <button key={size} onClick={() => { setTeamSize(size); setTeamA([]); setTeamB([]); }} className="btn mx-1">{size} a-side</button>
        ))}
      </div>

      {/* Centered logo and title */}
      <div className="text-center mb-6">
  <img src="/sacrifice_logo.png" alt="SACRIFICE Logo" className="h-32 mx-auto mb-2" />
  <h1 className="text-4xl font-bold">SACRIFICE</h1>
  <p className="italic text-gray-400 mt-1">The strongest team will survive.</p>
</div>

<div className="mb-6 text-center">
  <h3 className="font-bold mb-1">👥 Team Size</h3>
  <div>
    {[3, 5, 7].map(size => (
      <button
        key={size}
        onClick={() => {
          setTeamSize(size);
          setTeamA([]);
          setTeamB([]);
        }}
        className="btn mx-1"
      >
        {size} a-side
      </button>
    ))}
  </div>
</div>


      {/* Match Timer */}
      <div className="mb-6 text-center">
        <h3 className="font-bold mb-1">⏱️ Match Timer</h3>
        <div className="mb-2">
          {[5, 10, 15, 20].map(min => (
            <button key={min} onClick={() => { setMatchTime(min * 60); setTimer(min * 60); }} className="btn mx-1">{min} min</button>
          ))}
        </div>
        <div className="text-4xl font-mono">{formatTime(timer)}</div>
        <div className="mt-2 flex gap-2 justify-center">
          <button onClick={() => setMatchRunning(!matchRunning)} className="btn">{matchRunning ? "Pause" : "Start"}</button>
          <button onClick={() => setTimer(matchTime)} className="btn bg-red-600">Reset</button>
        </div>
      </div>

      {/* Player Search */}
      <div className="mb-6">
        <input type="text" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Search players..." className="p-2 rounded w-full text-black" />
        {searchResults.length > 0 && (
          <ul className="mt-2 space-y-2">
            {searchResults.map(player => (
              <li key={player.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                <div>{player.name} — {player.points} XP</div>
                <div className="flex gap-2">
                  <button onClick={() => assignPlayer(player, "A")} className="btn bg-blue-600">Team A</button>
                  <button onClick={() => assignPlayer(player, "B")} className="btn bg-green-600">Team B</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <input className="text-xl font-bold bg-transparent border-b w-full mb-2 text-center" value={teamAName} onChange={(e) => setTeamAName(e.target.value)} />
          <p className="text-2xl text-center mb-2">({scoreA})</p>
          <ul className="space-y-1">{teamA.map(p => (
            <li key={p.id} className="flex justify-between items-center">
              <span>⚪ {p.name}</span>
              <button onClick={() => addGoal(p, "A")} className="btn bg-yellow-500 text-black text-xs">+1</button>
            </li>
          ))}</ul>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <input className="text-xl font-bold bg-transparent border-b w-full mb-2 text-center" value={teamBName} onChange={(e) => setTeamBName(e.target.value)} />
          <p className="text-2xl text-center mb-2">({scoreB})</p>
          <ul className="space-y-1">{teamB.map(p => (
            <li key={p.id} className="flex justify-between items-center">
              <span>⚫ {p.name}</span>
              <button onClick={() => addGoal(p, "B")} className="btn bg-yellow-500 text-black text-xs">+1</button>
            </li>
          ))}</ul>
        </div>
      </div>

      {/* Log and Save */}
      <div className="mt-6">
        <h3 className="font-bold text-lg mb-2">📜 Match Log</h3>
        <ul className="text-sm space-y-1 text-gray-300">
          {log.map((entry, i) => <li key={i}>• {entry}</li>)}
        </ul>
        <button onClick={saveGame} className="btn mt-4 bg-green-700">💾 Save Game + Award XP</button>
      </div>

      <style jsx>{`
        .btn {
          background-color: #2563eb;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
