'use client';

import { useEffect, useRef } from 'react';

export default function TestCamera() {
  const videoRef = useRef(null);

  useEffect(() => {
    async function initCamera() {
      console.log('🎥 Requesting camera access...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('✅ Camera stream received');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('❌ Camera error:', err.message);
      }
    }

    initCamera();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-bold mb-4">Camera Test</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-md aspect-video rounded border border-white/20"
      />
    </main>
  );
}
