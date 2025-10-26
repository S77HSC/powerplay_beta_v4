'use client';

import { useEffect, useMemo, useState } from 'react';

// Map your asset ids to actual PNGs in /public
const IMAGE_MAP = {
  // Kits kept here to wire later (we’ll swap full-body PNGs when available)
  kit: {
    kit1: null, // '/characters/full/kits/red.png'  // if you create full-body assets later
    kit2: null, // '/characters/full/kits/blue.png'
    kit3: null, // '/characters/full/kits/legend_red_white.png'
  },
  // Boots kept here (we won't overlay until we have masked cutouts)
  boots: {
    boot1: '/characters/boots/power_boots.png',
    boot2: '/characters/boots/power_precision.png',
    boot3: '/characters/boots/speed_boots.png',
    boot4: '/characters/boots/star_striker.png',
  },
  // Balls: these we CAN place nicely in the striker’s hand
  ball: {
    ball1: '/characters/balls/ball1.png', // Premiere
    ball2: '/characters/balls/ball2.png', // Tango
    ball3: '/characters/balls/ball3.png', // World Cup
    ball4: '/characters/balls/ball4.png', // Champions League
    ball5: '/characters/balls/ball5.png', // Championship
    ball6: '/characters/balls/ball6.png', // Heritage
    ball7: '/characters/balls/ball7.png', // Non-League
  },
  accessory: {},
};

// A sane default so you always see something
const DEFAULT_EQUIPPED = {
  kit: 'kit1',
  boots: 'boot1',
  ball: 'ball7',
  accessory: null,
};

export default function AvatarLayers({ className = '' }) {
  // Start empty → read once after mount to avoid SSR mismatch and loops
  const [equipped, setEquipped] = useState(DEFAULT_EQUIPPED);
  const [mounted, setMounted] = useState(false);

  // Read once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pp_equipped');
      if (raw) {
        const parsed = JSON.parse(raw);
        setEquipped((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
    setMounted(true);
  }, []);

  // Re-read when locker/store writes an update
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('pp_equipped');
        if (raw) {
          const parsed = JSON.parse(raw);
          setEquipped((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
    };
    window.addEventListener('pp:equip', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('pp:equip', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Nothing fancy during SSR
  if (!mounted) {
    return (
      <div className={`relative w-[440px] h-[820px] ${className}`}>
        <img
          src="/characters/striker.png"
          alt="PowerPlay Striker"
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>
    );
  }

  const ballSrc = IMAGE_MAP.ball[equipped.ball] || null;
  // const bootsSrc = IMAGE_MAP.boots[equipped.boots] || null; // held for later
  // const kitSrc   = IMAGE_MAP.kit[equipped.kit]   || null; // held for later

  return (
    <div className={`relative w-[440px] h-[820px] ${className}`}>
      {/* Base striker */}
      <img
        src="/characters/striker.png"
        alt="PowerPlay Striker"
        className="absolute inset-0 w-full h-full object-contain z-10"
      />

      {/* Ball inside the hand (coords tuned for 440x820 box) */}
      {ballSrc && (
        <img
          src={ballSrc}
          alt=""
          className="absolute z-20 pointer-events-none select-none"
          style={{
            // tuned to sit in the glowing hand on your striker base
            left: '40.8%',
            top: '46.2%',
            width: '18.5%',
          }}
        />
      )}

      {/* Boot overlay intentionally omitted until we have masked, foot-aligned cutouts */}
      {/* Kit overlay intentionally omitted until we have full-body kit sprites */}
    </div>
  );
}
