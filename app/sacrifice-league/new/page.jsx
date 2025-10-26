'use client';

export const dynamic = 'force-dynamic';

import loadComponent from 'next/dynamic';
import { Suspense } from 'react';

const TournamentSetup = loadComponent(() => import('./TournamentSetup'), { ssr: false });

export default function PageWrapper() {
  return (
    <Suspense fallback={<div>Loading tournament setup...</div>}>
      <TournamentSetup />
    </Suspense>
  );
}
