'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sessionData } from '@lib/sessionData';

export default function DailyChallengeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unlockedKeys = Object.keys(sessionData || {});
    if (!unlockedKeys || unlockedKeys.length === 0) {
      alert("No unlocked skills available.");
      return;
    }

    const randomKey = unlockedKeys[Math.floor(Math.random() * unlockedKeys.length)];
    router.replace(`/skill-session/daily-player?session=${randomKey}`);
  }, [router]);

  return (
    <div className="text-white p-6 text-center">
      🚀 Loading your Daily Challenge...
    </div>
  );
}
