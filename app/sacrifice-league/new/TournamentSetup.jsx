'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandHeader from '../../../components/BrandHeader';
import Image from 'next/image';

export default function TournamentSetup() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tournamentName, setTournamentName] = useState('');
  const [tournamentType, setTournamentType] = useState('league');
  const [totalTeams, setTotalTeams] = useState(4);
  const [matchesPerTeam, setMatchesPerTeam] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [teams, setTeams] = useState([]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const addTeam = () => {
    if (teamName.trim() && teams.length < totalTeams) {
      setTeams(prev => {
        const updated = [...prev, { name: teamName.trim(), players: [] }];
        setSelectedTeamIndex(updated.length - 1);
        return updated;
      });
      setTeamName('');
    }
  };

  const addPlayerToTeam = async (index) => {
    if (playerName.trim()) {
      const newTeams = [...teams];
      const player = { name: playerName.trim() };

      try {
        const { data, error } = await fetch(`/api/find-player?name=${encodeURIComponent(player.name)}`).then(res => res.json());
        if (data && !error) {
          player.supabase = true;
        }
      } catch (err) {
        console.warn('Supabase check failed, adding as local player.');
      }

      newTeams[index].players.push(player);
      setTeams(newTeams);
      setPlayerName('');
    }
  };

  const goToFixtures = () => {
    const encodedTeams = btoa(encodeURIComponent(JSON.stringify(teams)));
    const query = new URLSearchParams({
      name: tournamentName,
      type: tournamentType,
      teams: encodedTeams,
      matches: matchesPerTeam
    }).toString();
    router.push(`/sacrifice-league/fixtures?${query}`);
  };

  return (
    <main className="bg-gradient-to-br from-[#050A1F] to-[#0c1228] min-h-screen px-4 py-10 text-white">
      <BrandHeader />
      <div className="flex justify-center mt-4 mb-6">
        <Image src="/tournament-sparkle.png" alt="Tournament Logo" width={80} height={80} />
      </div>

      <h1 className="text-3xl font-bold text-red-500 mb-6 text-center">Setup New Tournament</h1>

      <div className="max-w-md mx-auto mb-10 space-y-4">
        <input
          type="text"
          placeholder="Tournament Name"
          className="w-full px-3 py-2 text-black rounded"
          value={tournamentName}
          onChange={(e) => setTournamentName(e.target.value)}
        />
        <select
          className="w-full px-3 py-2 text-black rounded"
          value={tournamentType}
          onChange={(e) => setTournamentType(e.target.value)}
        >
          <option value="league">League</option>
          <option value="cup">Cup</option>
          <option value="champions">Champions League</option>
        </select>
        <label className="block text-sm font-semibold text-gray-300">Number of Teams</label>
        <input type="number" placeholder="Number of Teams"
          min="2"
          max="32"
          className="w-full px-3 py-2 text-black rounded"
          value={totalTeams}
          onChange={(e) => setTotalTeams(Number(e.target.value))}
        />
        <label className="block text-sm font-semibold text-gray-300">Matches per Team</label>
        <input type="number" placeholder="Matches per team"
          min="1"
          max="10"
          className="w-full px-3 py-2 text-black rounded"
          value={matchesPerTeam}
          onChange={(e) => setMatchesPerTeam(Number(e.target.value))}
        />
      </div>

      <div className="flex gap-2 mb-6 max-w-md mx-auto">
        <input
          type="text"
          className="flex-1 px-3 py-2 text-black rounded"
          placeholder="Enter team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded"
          onClick={addTeam}
        >
          Add
        </button>
      </div>

      <ul className="mb-6 space-y-2 max-w-md mx-auto">
        {teams.map((team, index) => (
          <li key={index} className="bg-[#1b223b] px-4 py-2 rounded text-sm font-medium">
            <div className="flex justify-between items-center">
              <span>{index + 1}. {team.name}</span>
              <button
                onClick={() => setSelectedTeamIndex(index === selectedTeamIndex ? null : index)}
                className="text-sm bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
              >
                {selectedTeamIndex === index ? 'Close' : 'Add Players'}
              </button>
            </div>

            {selectedTeamIndex === index && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Player name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="flex-1 px-2 py-1 text-black rounded"
                  />
                  <button
                    onClick={() => addPlayerToTeam(index)}
                    className="bg-green-600 px-3 text-white rounded"
                  >
                    Add
                  </button>
                </div>
                <ul className="list-disc list-inside text-gray-300 text-sm">
                  {team.players.map((player, i) => (
                    <li key={i}>{player.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="max-w-md mx-auto">
        <button
          disabled={teams.length !== totalTeams}
          className={`w-full font-bold py-2 rounded ${
            teams.length === totalTeams
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
          onClick={goToFixtures}
        >
          Create Fixtures ➔
        </button>
      </div>
    </main>
  );
}
