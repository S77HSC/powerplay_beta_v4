'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createLeagueTable, updateStandings } from '../../../powerplay-soccer/sacrifice/leagueEngine';
import BrandHeader from '../../../components/BrandHeader';

export default function PlayTournament() {
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

  const searchParams = useSearchParams();
  const tournamentName = searchParams.get('name') || 'Unnamed Tournament';

  const [teamList, setTeamList] = useState([]);
  const [decodedTeams, setDecodedTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [standings, setStandings] = useState([]);
  const [currentMatchday, setCurrentMatchday] = useState(0);
  const [inputScores, setInputScores] = useState({});
  const [goalScorers, setGoalScorers] = useState({});

{fixtures[currentMatchday] && (
  <>
    <h2 className="text-2xl font-semibold mb-4 text-center">
      Matchday {fixtures[currentMatchday].matchday}
    </h2>

    <ul className="space-y-6 mb-6">
      {fixtures[currentMatchday].fixtures.map((match, index) => {
        const homeKey = `${currentMatchday}-${index}-home`;
        const awayKey = `${currentMatchday}-${index}-away`;

        return (
          <li key={index} className="bg-[#1a1a1a] p-4 rounded-lg">
            <div className="mb-2 font-semibold text-lg">{match.home} vs {match.away}</div>

            <div className="flex justify-between items-center mb-4">
              <span className="w-24 text-right">{match.home}</span>
              <input
                type="number"
                value={inputScores[homeKey] || ''}
                onChange={(e) => setInputScores(prev => ({ ...prev, [homeKey]: Number(e.target.value) }))}
                className="w-12 text-black text-center rounded px-1 py-0.5"
              />
              <span>-</span>
              <input
                type="number"
                value={inputScores[awayKey] || ''}
                onChange={(e) => setInputScores(prev => ({ ...prev, [awayKey]: Number(e.target.value) }))}
                className="w-12 text-black text-center rounded px-1 py-0.5"
              />
              <span className="w-24 text-left">{match.away}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Home scorers */}
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
                          return { ...prev, [homeKey]: updated };
                        });
                      }}
                      className="w-12 px-2 py-0.5 text-black rounded"
                    />
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>

              {/* Away scorers */}
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
  <div className="mt-8 bg-[#1a1a1a] p-4 rounded-xl">
    <h2 className="text-xl font-bold text-center mb-4">🏅 Top Scorers</h2>
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
        {[...topScorers]
          .sort((a, b) => b.goals - a.goals)
          .map((player, index) => (
            <tr key={`${player.name}-${player.team}`} className="border-t border-gray-700">
              <td>{index + 1}</td>
              <td>{player.name}</td>
              <td>{player.team}</td>
              <td>{player.goals}</td>
            </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

{standings.length > 0 && (
  <div className="mt-8 bg-[#1c1c1c] p-4 rounded-xl">
    <h2 className="text-2xl font-bold text-center mb-4">
      {currentMatchday >= fixtures.length ? '🏁 Final Standings' : '📊 Current Standings'}
    </h2>
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
        {[...standings]
          .sort((a, b) => b.points - a.points)
          .map((team, index) => (
            <tr key={team.name} className="border-t border-gray-700">
              <td>{index + 1}</td>
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
)}


