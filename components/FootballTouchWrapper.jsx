'use client';

import dynamic from 'next/dynamic';

const FootballTouchTracker = dynamic(
  () => import('../../../../football_tracker/src/FootballTouchTracker'),
  { ssr: false }
);

export default FootballTouchTracker;
