"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function SacrificeGame() {
  const [introShown, setIntroShown] = useState(true);
  const [teamSize, setTeamSize] = useState(3);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [log, setLog] = useState([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [matchTime, setMatchTime] = useState(300);
  const [timer, setTimer] = useState(300);
  const [matchRunning, setMatchRunning] = useState(false);

  const resetGame = () => {
    setTeamA([]);
    setTeamB([]);
    setScoreA(0);
    setScoreB(0);
    setLog([]);
    setPlayerSearch("");
    setSearchResults([]);
    setTimer(matchTime);
    setMatchRunning(false);
    setIntroShown(true); // set false to skip intro
  };

  useEffect(() => {
    if (playerSearch.length >= 2) {
      fetchPlayers(playerSearch);
    } else {
      setSearchResults([]);
    }
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
    <div className="relative max-w-5xl mx-auto p-4 text-white bg-gray-900 min-h-screen">
      {introShown ? (
        <div className="absolute inset-0 bg-black z-50 flex flex-col justify-center items-center animate-fadeIn">
          <img src="/sacrifice_logo.png" alt="SACRIFICE Logo" className="h-60 mb-4 animate-scaleIn" />
          <h1 className="text-5xl font-bold mb-2">SACRIFICE</h1>
          <p className="text-lg italic text-gray-300 mb-6">The strongest team will survive.</p>
          <button onClick={() => setIntroShown(false)} className="btn bg-blue-600 animate-pulse px-6 py-2 rounded">Start Match</button>
        </div>
      ) : (
        <>
              {/* Centered logo and title */}
      <div className="text-center mb-6">
  <img src="/sacrifice_logo.png" alt="SACRIFICE Logo" className="h-32 mx-auto mb-2" />
  <h1 className="text-4xl font-bold">SACRIFICE</h1>
  <p className="italic text-gray-400 mt-1">The strongest team will survive.</p>
</div>
          <div className="text-center mb-6">
            <h3 className="font-bold mb-1">👥 Team Size</h3>
            {[3, 5, 7].map(size => (
              <button key={size} onClick={() => { setTeamSize(size); setTeamA([]); setTeamB([]); }} className="btn mx-1">{size} a-side</button>
            ))}
          </div>

          <div className="text-center mb-6">
            <h3 className="font-bold mb-1">⏱️ Match Timer</h3>
            {[5, 10, 15, 20].map(min => (
              <button key={min} onClick={() => { setMatchTime(min * 60); setTimer(min * 60); }} className="btn mx-1">{min} min</button>
            ))}
            <div className="text-4xl font-mono my-2">{formatTime(timer)}</div>
            <div className="flex justify-center gap-2">
              <button onClick={() => setMatchRunning(!matchRunning)} className="btn">{matchRunning ? "Pause" : "Start"}</button>
              <button onClick={() => setTimer(matchTime)} className="btn bg-red-600">Reset</button>
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            {[{ team: teamA, score: scoreA, name: teamAName, setName: setTeamAName, side: "A" },
              { team: teamB, score: scoreB, name: teamBName, setName: setTeamBName, side: "B" }].map(({ team, score, name, setName, side }) => (
              <div key={side} className="bg-gray-800 p-4 rounded">
                <input className="text-xl font-bold bg-transparent border-b w-full mb-2 text-center"
                  value={name} onChange={(e) => setName(e.target.value)} />
                <p className="text-2xl text-center mb-2">({score})</p>
                <ul className="space-y-1">
                  {team.map(p => (
                    <li key={p.id} className="flex justify-between items-center">
                      <span>{side === "A" ? "⚪" : "⚫"} {p.name}</span>
                      <button onClick={() => addGoal(p, side)} className="btn bg-yellow-500 text-black text-xs">+1</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="font-bold text-lg mb-2">📜 Match Log</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              {log.map((entry, i) => <li key={i}>• {entry}</li>)}
            </ul>
            <div className="flex flex-col items-center gap-3 mt-4">
              <button onClick={saveGame} className="btn bg-green-700">💾 Save Game + Award XP</button>
              <button onClick={resetGame} className="btn bg-red-700">🔁 New Game</button>
            </div>
          </div>
        </>
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
