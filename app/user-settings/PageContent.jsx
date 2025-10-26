'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Image from 'next/image';

export default function UserSettingsPage() {
  const router = useRouter();
  const [player, setPlayer] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      let { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!playerData || playerError) {
  console.error('Player data not found:', playerError);
  setLoading(false);
  return;
}


      setPlayer(playerData);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('player_id', playerData.id)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
      }

      setSessions(sessionsData || []);

      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      setTeams(allTeams || []);
      setSelectedTeam(playerData?.team_id || null);

      setLoading(false);
    };

    loadUserData();
  }, [router]);

  const getCountryFlag = (countryName) => {
    if (!countryName) return null;
    const code = {
      'United Kingdom': 'gb',
      England: 'gb',
      Scotland: 'gb',
      Wales: 'gb',
      USA: 'us',
      'United States': 'us',
      Spain: 'es',
      'South Korea': 'kr',
    }[countryName] || countryName.toLowerCase().slice(0, 2);

    return `https://flagcdn.com/w40/${code}.png`;
  };

  const handleTeamChangeRequest = async (e) => {
    e.preventDefault();
    if (!player || !selectedTeam || selectedTeam === player.team_id) return;

    const { error } = await supabase.from('team_change_requests').insert({
      player_id: player.id,
      current_team_id: player.team_id,
      requested_team_id: selectedTeam,
      status: 'pending',
    });

    if (error) {
      alert('Failed to submit team change request');
      console.error(error);
    } else {
      alert('Team change request submitted! Awaiting manager approval.');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const country = formData.get('country');
    const avatarFile = formData.get('avatar');

    let avatar_url = player.avatar_url;
    if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${player.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!uploadError) {
        avatar_url = filePath;
      }
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({ name, country, avatar_url })
      .eq('id', player.id);

    if (updateError) {
      alert('Failed to update profile');
      console.error(updateError);
    } else {
      alert('Profile updated!');
      router.refresh();
    }
  };

  const getTeamName = (id) => teams.find(t => t.id === id)?.name || '—';

  return (
    <main className="min-h-screen px-4 py-6 text-white bg-gradient-to-br from-black via-[#0a0f1c] to-black">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-cyan-400 mb-6">🛠️ User Settings</h1>

        {loading ? (
          <div className="text-blue-200 mb-8">Loading player profile...</div>
        ) : player ? (
          <div className="bg-gradient-to-r from-[#1f2937] to-[#111827] border border-blue-700 p-6 rounded-lg shadow-lg mb-8">
            <div className="flex items-center gap-6 mb-4">
              <Image
                src={
                  player.avatar_url
                    ? (player.avatar_url.startsWith('http')
                        ? player.avatar_url
                        : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`)
                    : '/default-avatar.png'
                }
                alt="Avatar"
                width={96}
                height={96}
                className="object-cover aspect-square rounded-full border-2 border-cyan-500"
              />

              <div>
                <h2 className="text-xl font-bold text-cyan-400">{player?.name}</h2>
                <p className="text-sm text-blue-300">
                  {player?.country && (
                    <>
                      <Image
                        src={getCountryFlag(player.country)}
                        alt={player.country}
                        width={24}
                        height={16}
                        className="inline-block mr-2"
                      />
                      {player.country}
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-400 mt-1">Team: {player.team || '—'}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs uppercase text-gray-400 mb-1">XP Progress</label>
              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 transition-all duration-700 animate-pulse"
                  style={{ width: `${Math.min((player.points % 1000) / 10, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-right text-gray-400 mt-1 animate-pulse">{player.points ?? 0} XP</p>
            </div>

            {/* Edit Profile Form */}
            <form onSubmit={handleProfileUpdate} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  name="name"
                  defaultValue={player.name}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Country</label>
<select
  name="country"
  defaultValue={player.country}
  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
>
  <option value="">Select a country</option>
  <optgroup label="Europe">
    <option value="United Kingdom">United Kingdom</option>
    <option value="England">England</option>
    <option value="Scotland">Scotland</option>
    <option value="Wales">Wales</option>
    <option value="Spain">Spain</option>
    <option value="Germany">Germany</option>
    <option value="France">France</option>
    <option value="Italy">Italy</option>
    <option value="Netherlands">Netherlands</option>
    <option value="Portugal">Portugal</option>
  </optgroup>
  <optgroup label="Americas">
    <option value="USA">USA</option>
    <option value="United States">United States</option>
    <option value="Brazil">Brazil</option>
    <option value="Argentina">Argentina</option>
    <option value="Canada">Canada</option>
    <option value="Mexico">Mexico</option>
  </optgroup>
  <optgroup label="Asia">
    <option value="Japan">Japan</option>
    <option value="China">China</option>
    <option value="India">India</option>
    <option value="South Korea">South Korea</option>
  </optgroup>
  <optgroup label="Oceania">
    <option value="Australia">Australia</option>
  </optgroup>
</select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Avatar</label>
                <input
                  type="file"
                  name="avatar"
                  accept="image/*"
                  className="w-full text-white"
                />
              </div>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
              >
                Save Profile
              </button>
            </form>

            {/* Team Change Request Section */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Request Team Change</h3>
              <form onSubmit={handleTeamChangeRequest} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Choose New Team</label>
                  <select
                    value={selectedTeam || ''}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="" disabled>Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-semibold"
                >
                  Submit Change Request
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="text-red-400">Failed to load player profile.</div>
        )}

        {/* Session List Section */}
        <h3 className="text-2xl font-bold mb-4">Your Sessions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="text-blue-200">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-blue-400 col-span-full">No sessions found. Start training to track progress!</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="bg-[#1f2937] border border-blue-600 p-4 rounded-lg shadow-md"
              >
                <h4 className="text-lg font-semibold text-white">📅 {new Date(session.created_at).toLocaleDateString()}</h4>
                <p className="text-sm text-blue-300 mt-1">XP Earned: {session.points}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
