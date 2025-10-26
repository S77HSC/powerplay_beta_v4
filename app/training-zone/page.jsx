'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import '@fontsource/rajdhani/700.css';

export default function TrainingZone() {
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const fetchPlayer = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return (window.location.href = '/login');

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (playerData) {
        setPlayer(playerData);
      }
    };

    fetchPlayer();
  }, []);

  if (!player) {
    return (
      <div className="text-white text-center mt-10">
        Loading Training Zone...
      </div>
    );
  }

  return (
    <main className="min-h-screen text-white font-[Rajdhani] p-6 flex flex-col items-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/training_zone_background.png"
          alt="Training Arena Background"
          fill
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-black opacity-40" />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center w-full max-w-[1600px] px-6 py-4 border-b border-gray-700 bg-gray-900 rounded-lg mb-4 z-10 flex-wrap gap-4 text-center sm:text-left border-cyan-400">
        <div className="flex items-center gap-4">
          <Image
            src="/powerplay-logo.png"
            alt="PowerPlay Logo"
            width={120}
            height={120}
          />
          <div className="text-3xl font-bold text-white uppercase tracking-wide">
            Training Zone
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase">{player.name}</p>
            <p className="text-md font-bold text-yellow-400 tracking-wide">
              XP: {player.points}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-500">
            <Image
              src={
                player.avatar_url?.startsWith('http')
                  ? player.avatar_url
                  : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`
              }
              alt="Avatar"
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 xl:grid-cols-12 auto-rows-[minmax(180px,_auto)] gap-4 w-full max-w-[1600px] z-10">

        {/* Daily Challenge */}
        <Link
          href="/skill-session"
          className="col-span-12 sm:col-span-6 md:col-span-4 xl:col-span-4 bg-gray-800 p-5 rounded-xl shadow-md hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400 relative overflow-hidden"
        >
          <Image
            src="/images/daily_challenge.png"
            alt="Daily Challenge"
            width={60}
            height={60}
            className="absolute top-3 right-3 z-10 opacity-90"
          />
          <div className="relative z-10">
            <h2 className="text-xl font-bold uppercase tracking-wide text-yellow-300 mb-2">
              Daily Challenge
            </h2>
            <p className="text-sm text-gray-300">
              Compete daily to earn extra XP and prizes.
            </p>
          </div>
        </Link>

        {/* Workout Builder */}
        <Link
          href="/workout-builder"
          className="col-span-12 sm:col-span-6 md:col-span-4 xl:col-span-4 bg-gray-800 p-5 rounded-xl shadow-md hover:scale-[1.01] transition-transform hover:shadow-md border border-yellow-500 hover:border-yellow-400 relative overflow-hidden"
        >
          <Image
            src="/images/workout-builder.png"
            alt="Workout Builder"
            width={100}
            height={100}
            className="absolute top-3 right-3 z-10 opacity-90"
          />
          <div className="relative z-10">
            <h2 className="text-xl font-bold uppercase tracking-wide text-yellow-300 mb-2">
              Workout Builder
            </h2>
            <p className="text-sm text-gray-300">
              Design HIIT-style drills for speed, agility & control.
            </p>
          </div>
        </Link>

        {/* Technical Zone (Locked) */}
<div className="col-span-12 sm:col-span-6 md:col-span-4 xl:col-span-4 bg-gray-700 p-5 rounded-xl shadow-md border border-yellow-500 relative opacity-60 cursor-not-allowed">
  <h2 className="text-xl font-bold uppercase tracking-wide text-gray-300 mb-2">
    Technical Zone
  </h2>
  <p className="text-sm text-gray-400">Coming Soon</p>
  <div className="absolute bottom-3 right-3 text-xs bg-yellow-400 text-black font-bold px-2 py-1 rounded">
    LOCKED
  </div>
</div>

        {/* Tactical Modules (Locked) */}
<div className="col-span-12 sm:col-span-6 md:col-span-4 xl:col-span-4 bg-gray-700 p-5 rounded-xl shadow-md border border-yellow-500 relative opacity-60 cursor-not-allowed">
  <h2 className="text-xl font-bold uppercase tracking-wide text-gray-300 mb-2">
    Tactical Modules
  </h2>
  <p className="text-sm text-gray-400">
    Strategy, formations, and decision-making.
  </p>
  <div className="absolute bottom-3 right-3 text-xs bg-yellow-400 text-black font-bold px-2 py-1 rounded">
    LOCKED
  </div>
</div>
      </div>
    </main>
  );
}
