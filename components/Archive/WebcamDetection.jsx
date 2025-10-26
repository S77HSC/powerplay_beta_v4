// Updated: Imported logic from user's .txt version with manual calibration and simplified brightness tracking
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function WebcamDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const [touchCount, setTouchCount] = useState(0);
  const [calibratedBall, setCalibratedBall] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [debug, setDebug] = useState(true);
  const lastTouchTime = useRef(0);
  const lastPosition = useRef(null);

  const initializeWebcam = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();
    }
  }, []);

  const getBrightness = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  const trackBall = useCallback((ctx, imageData) => {
    const width = imageData.width;
    const height = imageData.height;
    let maxBrightness = 0;
    let bestX = 0, bestY = 0;

    for (let y = 0; y < height; y += 6) {
      for (let x = 0; x < width; x += 6) {
        const i = (y * width + x) * 4;
        const brightness = getBrightness(
          imageData.data[i],
          imageData.data[i + 1],
          imageData.data[i + 2]
        );
        if (brightness > maxBrightness) {
          maxBrightness = brightness;
          bestX = x;
          bestY = y;
        }
      }
    }

    if (maxBrightness > 100) {
      const now = Date.now();
      if (lastPosition.current) {
        const dx = bestX - lastPosition.current.x;
        const dy = bestY - lastPosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 30 && now - lastTouchTime.current > 800) {
          setTouchCount((count) => count + 1);
          lastTouchTime.current = now;
        }
      }
      lastPosition.current = { x: bestX, y: bestY };

      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 4;
      ctx.strokeRect(bestX - 25, bestY - 25, 50, 50);
    }
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    trackBall(ctx, imageData);

    animationRef.current = requestAnimationFrame(processFrame);
  }, [trackBall]);

  const startTracking = useCallback(() => {
    setIsActive(true);
    processFrame();
  }, [processFrame]);

  const stopTracking = useCallback(() => {
    setIsActive(false);
    cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => {
    initializeWebcam();
  }, [initializeWebcam]);

  return (
    <div className="relative max-w-full">
      <video ref={videoRef} className="w-full rounded-xl" muted autoPlay style={{ backgroundColor: '#000' }} />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

      <div className="mt-4 flex justify-center space-x-4">
        {!isActive ? (
          <button onClick={startTracking} className="px-4 py-2 bg-green-600 rounded text-white">
            Start Tracking
          </button>
        ) : (
          <button onClick={stopTracking} className="px-4 py-2 bg-red-600 rounded text-white">
            Stop Tracking
          </button>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: '10px',
          fontSize: '26px',
          fontWeight: '700',
          userSelect: 'none',
        }}
      >
        Touches: {touchCount}
      </div>
    </div>
  );
}