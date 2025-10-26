"use client";

import { useState, useEffect } from "react";

export default function PowerPlayApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [playersA, setPlayersA] = useState([]);
  const [playersB, setPlayersB] = useState([]);
  const [selectedPowerPlaysA, setSelectedPowerPlaysA] = useState([]);
  const [selectedPowerPlaysB, setSelectedPowerPlaysB] = useState([]);
  const [powerPlayOptions] = useState(["Overload", "Double Trouble", "Hot Zone"]);
  const [activeTeam, setActiveTeam] = useState("");
  const [activePlay, setActivePlay] = useState("");
  const [powerTimer, setPowerTimer] = useState(0);
  const [isPowerActive, setIsPowerActive] = useState(false);
  const [matchTime, setMatchTime] = useState(300);
  const [timer, setTimer] = useState(300);
  const [matchRunning, setMatchRunning] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    const storedHistory = localStorage.getItem("matchHistory");
    if (storedHistory) setHistory(JSON.parse(storedHistory));
  }, []);

  useEffect(() => {
    if (!matchRunning) setTimer(matchTime);
  }, [matchTime, matchRunning]);

  useEffect(() => {
    let interval = null;
    if (matchRunning && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0 && matchRunning) {
      setMatchRunning(false);
    }
    return () => clearInterval(interval);
  }, [matchRunning, timer]);

  useEffect(() => {
    let interval = null;
    if (isPowerActive && powerTimer > 0) {
      interval = setInterval(() => setPowerTimer((t) => t - 1), 1000);
    } else if (powerTimer === 0 && isPowerActive) {
      setIsPowerActive(false);
      setActivePlay("");
      setActiveTeam("");
    }
    return () => clearInterval(interval);
  }, [isPowerActive, powerTimer]);

  const startPowerPlay = (team, play) => {
    setActiveTeam(team);
    setActivePlay(play);
    setPowerTimer(120);
    setIsPowerActive(true);
  };

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = t % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const addPlayer = (team) => {
    const name = prompt("Enter player name:");
    if (!name) return;
    const newPlayer = { name, points: 0 };
    if (team === "A") setPlayersA([...playersA, newPlayer]);
    else setPlayersB([...playersB, newPlayer]);
  };

  const updatePoints = (team, index, delta) => {
    const players = team === "A" ? [...playersA] : [...playersB];
    players[index].points += delta;
    if (team === "A") setPlayersA(players);
    else setPlayersB(players);
  };

  const getLeaderboard = () => {
    return [...playersA, ...playersB].sort((a, b) => b.points - a.points);
  };

  const getPlayIcon = (play) => {
    if (play === "Overload") return "/overload.png";
    if (play === "Double Trouble") return "/doubletrouble.png";
    if (play === "Hot Zone") return "/hotzone.png";
    return "";
  };

  const saveMatch = () => {
    const summary = {
      teamA, teamB, scoreA, scoreB,
      playersA, playersB,
      powerPlaysA: selectedPowerPlaysA,
      powerPlaysB: selectedPowerPlaysB,
      timestamp: new Date().toLocaleString(),
    };
    const newHistory = [...history, summary];
    setHistory(newHistory);
    localStorage.setItem("matchHistory", JSON.stringify(newHistory));
    alert("Match saved to history!");
  };

  const exportCSV = () => {
    const csvRows = [
      ["Team A", "Team B", "Score A", "Score B", "Time", "PowerPlays A", "PowerPlays B"],
      [teamA, teamB, scoreA, scoreB, new Date().toLocaleString(), selectedPowerPlaysA.join("|"), selectedPowerPlaysB.join("|")],
      [],
      ["Players", "Team", "Points"]
    ];

    playersA.forEach(p => csvRows.push([p.name, teamA, p.points]));
    playersB.forEach(p => csvRows.push([p.name, teamB, p.points]));

    const blob = new Blob([csvRows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `match_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen p-4 font-sans transition-all">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <img src="/logo.png" alt="PowerPlay Logo" className="h-20 w-20 object-contain" />
          <div className="flex items-center gap-2">
            <input type="text" value={teamA} onChange={(e) => setTeamA(e.target.value)} className="px-3 py-1 rounded border" />
            <span className="text-xl">vs</span>
            <input type="text" value={teamB} onChange={(e) => setTeamB(e.target.value)} className="px-3 py-1 rounded border" />
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="bg-black text-white px-4 py-2 rounded">{darkMode ? "Light" : "Dark"} Mode</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[{ team: teamA, players: playersA, side: "A", selections: selectedPowerPlaysA, setSelections: setSelectedPowerPlaysA },
            { team: teamB, players: playersB, side: "B", selections: selectedPowerPlaysB, setSelections: setSelectedPowerPlaysB }]
            .map(({ team, players, side, selections, setSelections }) => (
              <div key={team} className="bg-white dark:bg-gray-800 rounded p-3 shadow">
                <h2 className="text-lg font-semibold mb-2">{team} Players</h2>
                <button onClick={() => addPlayer(side)} className="mb-3 bg-blue-500 text-white px-3 py-1 rounded">+ Add Player</button>
                <ul className="mb-3">
                  {players.map((p, i) => (
                    <li key={i} className="flex justify-between items-center py-1">
                      <span>{p.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updatePoints(side, i, -1)} className="bg-gray-300 px-2 rounded">-</button>
                        <span>{p.points}</span>
                        <button onClick={() => updatePoints(side, i, 1)} className="bg-gray-300 px-2 rounded">+</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <h3 className="font-semibold mb-2">Select PowerPlays</h3>
                <div className="flex gap-2 flex-wrap">
                  {powerPlayOptions.map(play => (
                    <button
                      key={play}
                      disabled={selections.includes(play) || selections.length >= 2}
                      onClick={() => !selections.includes(play) && setSelections([...selections, play])}
                      className={`p-2 w-24 rounded flex flex-col items-center text-xs text-center transition ${
                        selections.includes(play) ? "bg-green-500 text-white" : "bg-white hover:bg-gray-100"
                      }`}
                    >
                      <img src={getPlayIcon(play)} alt={play} className="h-10 w-10 mb-1 object-contain" />
                      <span>{play}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  {selections.map((play) => (
                    <button key={play} onClick={() => startPowerPlay(team, play)} className="mr-2 mt-2 px-3 py-1 bg-blue-600 text-white rounded">
                      Start {team} - {play}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <div className="text-center my-6">
          <div className="text-3xl font-mono mb-2">{scoreA} v {scoreB}</div>
          <div className="flex justify-center gap-4">
            <button onClick={() => setScoreA(scoreA + 1)} className="bg-green-500 px-3 py-1 text-white rounded">+1 {teamA}</button>
            <button onClick={() => setScoreA(Math.max(0, scoreA - 1))} className="bg-red-500 px-3 py-1 text-white rounded">-1 {teamA}</button>
            <button onClick={() => setScoreB(scoreB + 1)} className="bg-green-500 px-3 py-1 text-white rounded">+1 {teamB}</button>
            <button onClick={() => setScoreB(Math.max(0, scoreB - 1))} className="bg-red-500 px-3 py-1 text-white rounded">-1 {teamB}</button>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl mb-2">Match Timer</h2>
          <div className="text-4xl font-mono">{formatTime(timer)}</div>
          <div className="mt-2 flex justify-center gap-2">
            <select value={matchTime} onChange={(e) => setMatchTime(Number(e.target.value))} className="px-2 py-1 rounded">
              {[300, 600, 900, 1200].map((s) => (
                <option key={s} value={s}>{s / 60} min</option>
              ))}
            </select>
            <button onClick={() => setMatchRunning(!matchRunning)} className="px-3 py-1 bg-blue-600 text-white rounded">
              {matchRunning ? "Pause" : "Start"}
            </button>
            <button onClick={() => { setMatchRunning(false); setTimer(matchTime); }} className="px-3 py-1 bg-gray-600 text-white rounded">
              Reset
            </button>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl mb-2">Active Power Play</h2>
          {isPowerActive ? (
            <div className="text-2xl font-mono">{activeTeam} - {activePlay} ({formatTime(powerTimer)})</div>
          ) : (
            <p className="text-gray-500">None</p>
          )}
        </div>

        <div className="text-center mb-6">
          <button onClick={saveMatch} className="bg-green-600 text-white px-4 py-2 rounded mr-2">Save Match</button>
          <button onClick={exportCSV} className="bg-yellow-600 text-white px-4 py-2 rounded">Export CSV</button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Leaderboard</h2>
          <ul>
            {getLeaderboard().map((p, i) => (
              <li key={i} className="flex justify-between">
                <span>{p.name}</span>
                <span className="font-mono">{p.points} pts</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-4">
          <h2 className="text-lg font-semibold mb-2">Match History</h2>
          {history.length === 0 ? (
            <p className="text-gray-500">No matches saved yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((m, i) => (
                <li key={i} className="border p-2 rounded bg-gray-100">
                  <strong>{m.teamA} {m.scoreA} - {m.scoreB} {m.teamB}</strong> <br />
                  <span className="text-sm text-gray-600">{m.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
