'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { getTour, getUnlockState } from '../../lib/tour';

const isValid = (v,min,max)=> typeof v==='number' && !Number.isNaN(v) && v>=min && v<=max;

export default function GlobeMap() {
  const ref = useRef();
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('players')
        .select('id, points')
        .eq('auth_id', user.id)
        .single();
      setPlayer(data);
    })();
  }, []);

  const tour = useMemo(() => getTour(), []);
  const { current, next } = useMemo(
    () => getUnlockState(player?.points || 0),
    [player]
  );

  // only items with good coords
  const pts = useMemo(() => {
    const list = tour.filter(s => isValid(s.lat,-90,90) && isValid(s.lng,-180,180));
    // debug bad ones once in console (optional)
    if (process.env.NODE_ENV !== 'production') {
      tour.forEach(s=>{
        if (s.lat!=null || s.lng!=null) {
          if (!isValid(s.lat,-90,90) || !isValid(s.lng,-180,180)) {
            // eslint-disable-next-line no-console
            console.warn('Bad coords for', s.id, s.lat, s.lng);
          }
        }
      });
    }
    const unlocked = (p)=> (player?.points || 0) >= s.unlockXP;
    return list.map(s=>{
      const isUnlocked = (player?.points || 0) >= s.unlockXP;
      const isNext = next && s.id === next.id;
      return {
        ...s,
        size: isNext ? 1.2 : 0.8,
        color: isUnlocked ? '#22c55e' : isNext ? '#f59e0b' : '#64748b'
      };
    });
  }, [tour, player, next]);

  const arc = useMemo(() => {
    if (!current || !next) return [];
    if (!isValid(current.lat,-90,90) || !isValid(current.lng,-180,180)) return [];
    if (!isValid(next.lat,-90,90) || !isValid(next.lng,-180,180)) return [];
    return [{
      startLat: current.lat, startLng: current.lng,
      endLat: next.lat,     endLng: next.lng,
      color: ['#22d3ee','#3b82f6']
    }];
  }, [current, next]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.controls().autoRotate = true;
    ref.current.controls().autoRotateSpeed = 0.6;
  }, []);

  if (!player) return <div className="text-white">Loading player…</div>;
  if (pts.length === 0) return <div className="text-white/80">Add lat/lng in <code>stadiumCoords.js</code> to see pins.</div>;

  return (
    <div className="relative w-full h-[60vh] rounded-2xl overflow-hidden border border-white/10">
      <Globe
        ref={ref}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="rgba(0,0,0,0)"
        pointsData={pts}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.8}
        pointLabel={d => `${d.title}\n${d.stadium??''} • ${d.location??''}\nUnlocks at ${d.unlockXP} XP`}
        arcsData={arc}
        arcColor={'color'}
        arcDashLength={0.35}
        arcDashGap={0.15}
        arcDashAnimateTime={2800}
        arcAltitudeAutoScale
        animateIn
      />

      {/* Header + next CTA */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto text-white">
          <h2 className="text-lg font-bold">World Stadium Tour</h2>
          <p className="text-sm text-gray-300">
            Points: <span className="text-cyan-400 font-semibold">{player.points}</span>
          </p>
          <div className="flex gap-3 text-xs text-gray-300 mt-1">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" />Unlocked</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" />Next</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#64748b] inline-block" />Locked</span>
          </div>
        </div>

        {next && (
          <div className="pointer-events-auto text-right text-xs text-gray-200">
            <div>Next: <span className="font-semibold">{next.title}</span></div>
            <div className="text-gray-400">{next.stadium ?? ''} • {next.location ?? ''}</div>
            <div className="text-gray-400">Needs {Math.max(0, next.unlockXP - player.points)} XP</div>
            {player.points >= next.unlockXP ? (
              <Link href={`/skill-session?session=${next.id}`} className="inline-block mt-2 px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white">▶ Start Session</Link>
            ) : (
              <Link href={`/unlock-skill?skill=${next.id}`} className="inline-block mt-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Unlock Now</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
