'use client';

import { useEffect, useRef, useState } from 'react';

let globalStream = null; // Singleton webcam stream

export default function WebcamDetection({ onTouchDetected, active }) {
  const videoRef = useRef(null);
  const lastTouchRef = useRef(Date.now());
  const [showTouch, setShowTouch] = useState(false);
  const touchCooldown = 600; // milliseconds

  const MODEL_ENDPOINT = "http://127.0.0.1:8000/detect-football/";

  // Setup camera once on mount
  useEffect(() => {
    const setupCamera = async () => {
      if (!videoRef.current) return;
      if (globalStream) {
        videoRef.current.srcObject = globalStream;
        await videoRef.current.play();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        globalStream = stream;
        videoRef.current.srcObject = globalStream;
        await videoRef.current.play();
      } catch (err) {
        console.error("Webcam access denied or failed:", err);
      }
    };

    setupCamera();
  }, []);

  useEffect(() => {
    let interval;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');

        try {
          const response = await fetch(MODEL_ENDPOINT, {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();
          console.log("Backend response:", result);

          const predictions = result.predictions || [];
          const detected = predictions.some(p => p.class === 'sports ball' && p.confidence > 0.5);

          if (detected && Date.now() - lastTouchRef.current > touchCooldown) {
            lastTouchRef.current = Date.now();
            setShowTouch(true);
            if (onTouchDetected) onTouchDetected();
            setTimeout(() => setShowTouch(false), 500);
          }
        } catch (err) {
          console.error('Detection error:', err);
        }
      }, 'image/jpeg');
    };

    if (active) {
      interval = setInterval(detect, 1000);
    }
    return () => clearInterval(interval);
  }, [active, onTouchDetected]);

  return (
    <div className="relative">
      <video ref={videoRef} id="live-webcam" className="w-full rounded-xl" playsInline muted />
      {showTouch && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-green-500 text-white font-bold text-xl px-4 py-2 rounded-xl shadow-lg animate-pulse">
            TOUCH!
          </div>
        </div>
      )}
    </div>
  );
}

// Webcam now initializes immediately on component mount
// Canvas is off-DOM and used for detection only