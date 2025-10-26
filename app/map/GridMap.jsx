'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { sessionData } from '../../lib/sessionData';
import Link from 'next/link';
import Image from 'next/image';

export default function GridMap() {
  const [player, setPlayer] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase
        .from('players')
        .select('id, points')
        .eq('auth_id', user.id)
        .single();

      if (playerData) setPlayer(playerData);
    };
    fetchPlayer();
  }, []);

  const tour = useMemo(() => {
    return Object.entries(sessionData)
      .map(([id, obj]) => ({ id, ...obj }))
      .sort((a, b) => a.unlockXP - b.unlockXP);
  }, []);

  if (!player) return <div className="text-white p-10">Loading player profile…</div>;

  // first locked index to highlight "Next"
  const firstLockedIndex = tour.findIndex(s => player.points < s.unlockXP);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {tour.map((skill, idx) => {
        const unlocked = player.points >= skill.unlockXP;
        const isNext = firstLockedIndex === idx;

        return (
          <article
            key={skill.id}
            className={[
              "relative bg-gray-900 border rounded-xl shadow-md overflow-hidden transition-all hover:shadow-lg",
              unlocked ? "border-green-500" : isNext ? "border-yellow-500" : "border-gray-800"
            ].join(" ")}
          >
            <div className="w-full h-40 relative">
              <Image
                src={skill.thumbnail}
                alt={skill.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            <div className="p-4">
              <h3 className="text-white font-semibold">{skill.title}</h3>

              {(skill.stadium || skill.location) && (
                <p className="text-xs text-gray-300 mb-1">
                  {skill.stadium ?? '—'} • {skill.location ?? '—'}
                </p>
              )}

              <p className="text-xs text-gray-400 mb-3">
                Unlocks at <span className="text-white font-semibold">{skill.unlockXP} XP</span>
              </p>

              {unlocked ? (
                <Link
                  href={`/skill-session?session=${skill.id}`}
                  className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                >
                  ▶ Start Session
                </Link>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-300">
                    🔒 {Math.max(0, skill.unlockXP - player.points)} XP needed
                  </span>
                  <Link
                    href={`/unlock-skill?skill=${skill.id}`}
                    className="ml-auto px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Unlock Now
                  </Link>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
