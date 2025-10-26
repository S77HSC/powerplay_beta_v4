'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import DailyPlayerContent from './DailyPlayerContent';

export default function DailyPlayerPage() {
  return (
    <Suspense fallback={<div className="text-center text-white mt-10">Loading workout…</div>}>
      <DailyPlayerContent />
    </Suspense>
  );
}
