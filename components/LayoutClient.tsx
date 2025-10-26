'use client';

import dynamic from 'next/dynamic';

// Either dynamic (if these touch the DOM at import)
// or direct imports if they’re already client components.
const FullscreenPrompt = dynamic(
  () => import('../components/fullscreen/FullscreenPrompt'),
  { ssr: false }
);
const FloatingDM = dynamic(
  () => import('../components/FloatingDM'),
  { ssr: false }
);

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FullscreenPrompt />
      {children}
      <FloatingDM />
    </>
  );
}
