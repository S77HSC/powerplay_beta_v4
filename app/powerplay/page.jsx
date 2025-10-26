
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function PowerPlayMatchManager() {
  const [players, setPlayers] = useState([]);
  const [playersA, setPlayersA] = useState([]);
  const [playersB, setPlayersB] = useState([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase.from("players").select("*");
      if (error) console.error("Error loading players:", error.message);
      else setPlayers(data);
    };
    fetchPlayers();
  }, []);

  const assignPlayer = (player, team) => {
    if (team === "A" && !playersA.find(p => p.id === player.id)) {
      setPlayersA([...playersA, player]);
    } else if (team === "B" && !playersB.find(p => p.id === player.id)) {
      setPlayersB([...playersB, player]);
    }
  };
  const [introShown, setIntroShown] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [powerPlayOptions] = useState(["Overload", "Double Trouble", "Hot Zone"]);
  const [activeTeam, setActiveTeam] = useState("");
  const [activePlay, setActivePlay] = useState("");
  const [powerTimer, setPowerTimer] = useState(0);
  const [isPowerActive, setIsPowerActive] = useState(false);
  const [matchTime, setMatchTime] = useState(300);
  const [timer, setTimer] = useState(300);
  const [matchRunning, setMatchRunning] = useState(false);
  const [powerPlayDuration, setPowerPlayDuration] = useState(120);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    let interval = null;
    if (matchRunning && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && matchRunning) {
      setMatchRunning(false);
    }
    return () => clearInterval(interval);
  }, [matchRunning, timer]);

  useEffect(() => {
    let interval = null;
    if (isPowerActive && powerTimer > 0) {
      interval = setInterval(() => setPowerTimer(t => t - 1), 1000);
    } else if (powerTimer === 0 && isPowerActive) {
      resetPowerPlay();
    }
    return () => clearInterval(interval);
  }, [isPowerActive, powerTimer]);

  const startPowerPlay = (team, play) => {
    setActiveTeam(team);
    setActivePlay(play);
    setPowerTimer(powerPlayDuration);
    setIsPowerActive(true);
  };

  const resetPowerPlay = () => {
    setIsPowerActive(false);
    setPowerTimer(0);
    setActivePlay("");
    setActiveTeam("");
  };

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = t % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const saveMatch = () => {
    const summary = {
      teamA,
      teamB,
      scoreA,
      scoreB,
      powerPlay: activePlay,
      timestamp: new Date().toLocaleString(),
    };
    setHistory(prev => [...prev, summary]);
    alert("Match saved!");
  };

  return (
    <div className={darkMode ? "bg-gray-900 text-white" : "bg-white text-black"}>
      {introShown ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white text-center animate-fadeIn">
          <img src="/logo.png" alt="PowerPlay Logo" className="h-32 mb-4 animate-scaleIn" />
          <h1 className="text-4xl font-bold mb-2">POWERPLAY</h1>
          <p className="italic text-gray-400 mb-6">Ready to Play?</p>
          <button onClick={() => setIntroShown(false)} className="btn bg-purple-600 hover:bg-purple-700 transition px-6 py-2 rounded text-lg">
            Start Match
          </button>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <img src="/logo.png" alt="logo" className="h-12" />
            <div className="flex gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="btn bg-blue-600">
                {darkMode ? "Light" : "Dark"} Mode
              </button>
              <button onClick={saveMatch} className="btn bg-green-600">💾 Save</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { score: scoreA, setScore: setScoreA, name: teamA, setName: setTeamA, side: "A" },
              null,
              { score: scoreB, setScore: setScoreB, name: teamB, setName: setTeamB, side: "B" }
            ].map((col, i) => (
              col ? (
                <div key={i} className="p-4 bg-gray-800 rounded shadow">
                  <input className="text-2xl font-bold bg-transparent border-b w-full mb-4"
                    value={col.name} onChange={(e) => col.setName(e.target.value)} />
                  <p className="text-center text-4xl">{col.score}</p>
                  <div className="flex justify-center mt-4 gap-2">
                    <button onClick={() => col.setScore(col.score + 1)} className="btn">+1</button>
                    <button onClick={() => col.setScore(Math.max(0, col.score - 1))} className="btn">-1</button>
                  </div>
                      
<div className="mt-4">
                    
{powerPlayOptions.map(play => (
  <button key={play} onClick={() => startPowerPlay(name, play)} className="btn w-full mb-2">
    <span className="flex items-center justify-start">
      <img src={`/${play.toLowerCase().replaceAll(" ", "")}.png`} alt={play} className="h-8 w-8 mr-3" />
      ⚡ {play}
    </span>
  </button>
))}

                  </div>
                </div>
              ) : (
                <div key={i} className="p-4 bg-gray-700 rounded shadow text-center">
                  <h2 className="text-xl mb-2">Match Timer</h2>
                  
                  <div className="mb-4">
                    <h3 className="font-bold mb-1">Match Duration</h3>
                    {[5, 10, 15, 20].map(min => (
                      <button
                        key={min}
                        onClick={() => {
                          const seconds = min * 60;
                          setMatchTime(seconds);
                          if (!matchRunning) setTimer(seconds);
                        }}
                        className={`btn mx-1 ${matchTime === min * 60 ? 'bg-purple-600' : ''}`}
                      >
                        {min} min
                      </button>
                    ))}
                  </div>

<div className="text-5xl font-mono mb-4">{formatTime(timer)}</div>
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setMatchRunning(!matchRunning)} className="btn">
                      {matchRunning ? "Pause" : "Start"}
                    </button>
                    <button onClick={() => setTimer(matchTime)} className="btn bg-red-600">Reset</button>
                  </div>
                  <div className="mt-4">
                    <label className="block mb-1 font-semibold">PowerPlay Duration</label>
                    <select value={powerPlayDuration} onChange={(e) => setPowerPlayDuration(Number(e.target.value))}
                      className="text-black p-1 rounded w-full">
                      {[30, 60, 90, 120].map(sec => (
                        <option key={sec} value={sec}>{sec} seconds</option>
                      ))}
                    </select>
                    <button onClick={resetPowerPlay} className="btn mt-2 bg-yellow-500 text-black w-full">Reset PowerPlay</button>
                  </div>
                  {isPowerActive && (
                    <div className="mt-4 bg-yellow-300 text-black p-2 rounded">
                      🔥 {activeTeam} - {activePlay} ({formatTime(powerTimer)})
                    </div>
                  )}
                </div>
              )
            ))}
          </div>

          
      <div className="mt-10">
        <h3 className="text-lg font-bold mb-4">Assign Players</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="mb-2 font-semibold">Team A</h4>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => assignPlayer(p, "A")}
                className="btn bg-blue-600 w-full mb-1"
              >
                {p.name} ({p.points} XP)
              </button>
            ))}
            <ul className="text-sm mt-3 text-gray-300">
              {playersA.map((p) => <li key={p.id}>⚪ {p.name}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">Team B</h4>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => assignPlayer(p, "B")}
                className="btn bg-green-600 w-full mb-1"
              >
                {p.name} ({p.points} XP)
              </button>
            ))}
            <ul className="text-sm mt-3 text-gray-300">
              {playersB.map((p) => <li key={p.id}>⚫ {p.name}</li>)}
            </ul>
          </div>
        </div>
      </div>


      <div className="mt-6">
            <h3 className="font-bold mb-2 text-lg">📜 Match History</h3>
            {history.map((m, i) => (
              <div key={i} className="text-sm text-gray-300">
                {m.teamA} {m.scoreA} - {m.scoreB} {m.teamB} ({m.timestamp})
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .btn {
          background-color: #2563eb;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }
        .animate-fadeIn { animation: fadeIn 1s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
