'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import PageContent from './PageContent';

export default function SkillPlayerPage() {
  // PageContent already lazy-loads BallTouchTrackerFinal with ssr:false
  return <PageContent />;
}
