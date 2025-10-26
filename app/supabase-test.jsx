'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SupabaseTestPage() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase.from('players').select('*');
      if (error) {
        console.error('Error fetching players:', error.message);
      } else {
        setPlayers(data);
      }
    };

    fetchPlayers();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Players from Supabase</h1>
      <ul className="list-disc list-inside">
        {players.length > 0 ? (
          players.map((player) => (
            <li key={player.id}>
              {player.name} – {player.points} pts
            </li>
          ))
        ) : (
          <li>No players found</li>
        )}
      </ul>
    </div>
  );
}
