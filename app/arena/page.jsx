import { Suspense } from 'react';
import ArenaClient from './ArenaClient';

// Prevent static prerender/export errors for /arena.
// If you later want ISR or caching, you can swap these for `export const revalidate = 60;`
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function ArenaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-200">Loading Arena…</div>}>
      <ArenaClient />
    </Suspense>
  );
}
