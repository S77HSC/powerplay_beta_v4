'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createLeagueTable, updateStandings } from '../../../powerplay-soccer/sacrifice/leagueEngine';
import BrandHeader from '../../../components/BrandHeader';
import Image from 'next/image';

export default function PlayTournament() {
  const searchParams = useSearchParams();
  const tournamentName = searchParams.get('name') || 'Unnamed Tournament';
  const [currentMatchday, setCurrentMatchday] = useState(0);
  const [fixtures, setFixtures] = useState([]);
  const [teamList, setTeamList] = useState([]);
  const [decodedTeams, setDecodedTeams] = useState([]);
  const [standings, setStandings] = useState([]);
  const [inputScores, setInputScores] = useState({});
  const [goalScorers, setGoalScorers] = useState({});
  const [topScorers, setTopScorers] = useState([]);

  const whistleStart = useRef(null);
  const whistleEnd = useRef(null);
  const [timerInput, setTimerInput] = useState(10);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isRunning && remainingTime > 0) {
      interval = setTimeout(() => setRemainingTime(prev => prev - 1), 1000);
    } else if (remainingTime === 0 && isRunning) {
      whistleEnd.current?.play();
      setIsRunning(false);
    }
    return () => clearTimeout(interval);
  }, [isRunning, remainingTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setRemainingTime(timerInput * 60);
    setIsRunning(true);
    whistleStart.current?.play();
  };

  const pauseTimer = () => setIsRunning(false);
  const resetTimer = () => {
    setIsRunning(false);
    setRemainingTime(0);
  };

  useEffect(() => {
    try {
      const decodedTeamsData = JSON.parse(decodeURIComponent(atob(searchParams.get('teams') || '')));
      const decodedFixtures = JSON.parse(decodeURIComponent(atob(searchParams.get('fixtures') || '')));
      const teamNames = decodedTeamsData.map(team => team.name);
      setDecodedTeams(decodedTeamsData);
      setTeamList(teamNames);
      setFixtures(decodedFixtures);
      setStandings(createLeagueTable(teamNames));
    } catch (err) {
      console.error('Error loading play data:', err);
    }
  }, [searchParams]);

  const updateScoresFromScorers = (key, updatedList) => {
    const goals = updatedList.reduce((sum, p) => sum + p.goals, 0);
    setInputScores(prev => ({ ...prev, [key]: goals }));
  };

  const submitMatchday = () => {
    const updatedStandings = [...standings];
    const matchday = fixtures[currentMatchday];
    const scorerMap = {};

    matchday.fixtures.forEach((match, index) => {
      const homeKey = `${currentMatchday}-${index}-home`;
      const awayKey = `${currentMatchday}-${index}-away`;
      const homeGoals = inputScores[homeKey] || 0;
      const awayGoals = inputScores[awayKey] || 0;
      updateStandings(updatedStandings, { ...match, homeGoals, awayGoals });

      (goalScorers[homeKey] || []).forEach(p => {
        const id = `${match.home}-${p.name}`;
        scorerMap[id] = { name: p.name, team: match.home, goals: (scorerMap[id]?.goals || 0) + p.goals };
      });
      (goalScorers[awayKey] || []).forEach(p => {
        const id = `${match.away}-${p.name}`;
        scorerMap[id] = { name: p.name, team: match.away, goals: (scorerMap[id]?.goals || 0) + p.goals };
      });
    });

    const newTop = Object.values(
      [...Object.values(scorerMap), ...topScorers].reduce((acc, curr) => {
        const key = `${curr.team}-${curr.name}`;
        if (!acc[key]) acc[key] = { ...curr };
        else acc[key].goals += curr.goals;
        return acc;
      }, {})
    );

    setTopScorers(newTop);
    setStandings(updatedStandings);
    setCurrentMatchday(prev => prev + 1);
    setInputScores({});
    setGoalScorers({});
  };

  return (
    <main className="bg-gradient-to-br from-[#050A1F] to-[#0c1228] min-h-screen px-4 py-10 text-white max-w-4xl mx-auto">
      <BrandHeader />
      <div className="flex justify-center mt-4 mb-6">
        <Image src="/tournament-sparkle.png" alt="Tournament Logo" width={80} height={80} />
      </div>
      <h1 className="text-3xl font-bold text-red-500 text-center mb-6">{tournamentName}</h1>

      <div className="text-center my-4">
        <label className="block mb-1 font-semibold">Match Length (minutes)</label>
        <input
          type="number"
          min="5"
          max="45"
          value={timerInput}
          onChange={(e) => setTimerInput(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded text-black"
        />
        <div className="text-2xl font-bold mt-2">⏱ {formatTime(remainingTime)}</div>
        <div className="flex justify-center gap-4 mt-2">
          <button onClick={startTimer} className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded">Start</button>
          <button onClick={pauseTimer} className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded">Pause</button>
          <button onClick={resetTimer} className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded">Reset</button>
        </div>
        <audio ref={whistleStart} src="/sounds/whistle-start.mp3" preload="auto" />
        <audio ref={whistleEnd} src="/sounds/whistle-stop.mp3" preload="auto" />
      </div>

      {fixtures[currentMatchday] && (
        <>
          <h2 className="text-2xl font-semibold mb-4 text-center">Matchday {fixtures[currentMatchday].matchday}</h2>
          <ul className="space-y-6 mb-6">
            {fixtures[currentMatchday].fixtures.map((match, index) => {
              const homeKey = `${currentMatchday}-${index}-home`;
              const awayKey = `${currentMatchday}-${index}-away`;

              return (
                <li key={index} className="bg-[#1a1a1a] p-4 rounded-lg">
                  <div className="mb-2 font-semibold text-lg">{match.home} vs {match.away}</div>

                  <div className="flex items-center gap-2 mb-2">
  <span className="w-24 text-right">{match.home}</span>
  <input
    type="number"
    value={inputScores[homeKey] ?? 0}
    onChange={(e) => setInputScores(prev => ({ ...prev, [homeKey]: Number(e.target.value) }))}
    className="w-12 text-black text-center rounded px-1 py-0.5"
  />
  <span>-</span>
  <input
    type="number"
    value={inputScores[awayKey] ?? 0}
    onChange={(e) => setInputScores(prev => ({ ...prev, [awayKey]: Number(e.target.value) }))}
    className="w-12 text-black text-center rounded px-1 py-0.5"
  />
  <span className="w-24">{match.away}</span>
</div>

{/* Goal Scorer Inputs */}
<div className="grid grid-cols-2 gap-4 mt-4">
  <div>
    <div className="font-semibold text-white mb-1">{match.home} Scorers:</div>
    {(decodedTeams.find(team => team.name === match.home)?.players || []).map((player, pIdx) => (
      <div key={pIdx} className="flex items-center gap-2 mb-1">
        <input
          type="number"
          min={0}
          placeholder="0"
          value={goalScorers[homeKey]?.find(p => p.name === player.name)?.goals || ''}
          onChange={(e) => {
            const value = Number(e.target.value);
            setGoalScorers(prev => {
              const existing = prev[homeKey] || [];
              const updated = existing.filter(p => p.name !== player.name);
              if (!isNaN(value) && value > 0) {
                updated.push({ name: player.name, goals: value });
              }
              updateScoresFromScorers(homeKey, updated);
              return { ...prev, [homeKey]: updated };
            });
          }}
          className="w-12 px-2 py-0.5 text-black rounded"
        />
        <span>{player.name}</span>
      </div>
    ))}
  </div>
  <div>
    <div className="font-semibold text-white mb-1">{match.away} Scorers:</div>
    {(decodedTeams.find(team => team.name === match.away)?.players || []).map((player, pIdx) => (
      <div key={pIdx} className="flex items-center gap-2 mb-1">
        <input
          type="number"
          min={0}
          placeholder="0"
          value={goalScorers[awayKey]?.find(p => p.name === player.name)?.goals || ''}
          onChange={(e) => {
            const value = Number(e.target.value);
            setGoalScorers(prev => {
              const existing = prev[awayKey] || [];
              const updated = existing.filter(p => p.name !== player.name);
              if (!isNaN(value) && value > 0) {
                updated.push({ name: player.name, goals: value });
              }
              updateScoresFromScorers(awayKey, updated);
              return { ...prev, [awayKey]: updated };
            });
          }}
          className="w-12 px-2 py-0.5 text-black rounded"
        />
        <span>{player.name}</span>
      </div>
    ))}
  </div>
</div>
                </li>
              );
            })}
          </ul>

          <div className="text-center">
            <button
              onClick={submitMatchday}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded"
            >
              Submit Matchday
            </button>
          </div>
        </>
      )}
    {topScorers.length > 0 && (
        <div className="mt-10 bg-[#1a1a1a] p-4 rounded-lg">
          <h2 className="text-xl font-bold text-center mb-4 text-yellow-400">🏅 Top Scorers</h2>
          <table className="w-full text-sm text-center border border-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {[...topScorers].sort((a, b) => b.goals - a.goals).map((p, i) => (
                <tr key={`${p.team}-${p.name}`} className="border-t border-gray-700">
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.team}</td>
                  <td>{p.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {standings.length > 0 && (
        <div className="mt-10 bg-[#1a1a1a] p-4 rounded-lg">
          <h2 className="text-xl font-bold text-center mb-4 text-cyan-400">📊 Current Standings</h2>
          <table className="w-full text-sm text-center border border-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>PL</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GA</th>
                <th>GD</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              {[...standings].sort((a, b) => b.points - a.points).map((team, i) => (
                <tr key={team.name} className="border-t border-gray-700">
                  <td>{i + 1}</td>
                  <td>{team.name}</td>
                  <td>{team.played}</td>
                  <td>{team.wins}</td>
                  <td>{team.draws}</td>
                  <td>{team.losses}</td>
                  <td>{team.goalsFor}</td>
                  <td>{team.goalsAgainst}</td>
                  <td>{team.goalsFor - team.goalsAgainst}</td>
                  <td>{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}