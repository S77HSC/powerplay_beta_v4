'use client';

import React, { useEffect, useRef, useState } from 'react';

const FootballTouchTracker = ({ active = true, onTouchDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [touches, setTouches] = useState(0);
  const lastTouchTime = useRef(Date.now());
  const prevZone = useRef(null);

  const ZONE_ROWS = 8;
  const ZONE_COLS = 8;

  const API_URL = process.env.NEXT_PUBLIC_MODEL_ENDPOINT || 'http://localhost:5000';

  useEffect(() => {
    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };
    startCamera();
  }, []);

  useEffect(() => {
    const sendFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== 4) {
        setTimeout(() => requestAnimationFrame(sendFrame), 100);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setTimeout(() => requestAnimationFrame(sendFrame), 100);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/jpeg');

      try {
        const res = await fetch(`${API_URL}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData }),
        });

        const data = await res.json();
        const balls = data.balls || [];

        if (balls.length > 0) {
          const ball = balls[0];
          const cx = (ball.x1 + ball.x2) / 2;
          const cy = (ball.y1 + ball.y2) / 2;

          const rowHeight = canvas.height / ZONE_ROWS;
          const colWidth = canvas.width / ZONE_COLS;

          const currentZone = {
            row: Math.floor(cy / rowHeight),
            col: Math.floor(cx / colWidth)
          };

          const inFootZone = cy > canvas.height - 100;
          const timeSinceLastTouch = Date.now() - lastTouchTime.current;

          const zoneChanged =
            !prevZone.current ||
            currentZone.row !== prevZone.current.row ||
            currentZone.col !== prevZone.current.col;

          if (zoneChanged && inFootZone && timeSinceLastTouch > 300) {
            setTouches(t => {
              const updated = t + 1;
              if (onTouchDetected) onTouchDetected(updated);
              return updated;
            });

            lastTouchTime.current = Date.now();
            console.log("✅ Touch detected via zone change!");
          }

          prevZone.current = currentZone;

          // Draw red bounding box
          ctx.beginPath();
          ctx.rect(ball.x1, ball.y1, ball.x2 - ball.x1, ball.y2 - ball.y1);
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'red';
          ctx.stroke();

          // Ball center
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'lime';
          ctx.fill();

          // Foot zone line
          ctx.beginPath();
          ctx.moveTo(0, canvas.height - 100);
          ctx.lineTo(canvas.width, canvas.height - 100);
          ctx.strokeStyle = 'orange';
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          prevZone.current = null;
        }
      } catch (error) {
        console.error('Detection error:', error);
      }

      setTimeout(() => requestAnimationFrame(sendFrame), 100);
    };

    requestAnimationFrame(sendFrame);
  }, [API_URL]);

  return (
    <div>
      <h2>Touches: {touches}</h2>
      <video ref={videoRef} autoPlay playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ width: '320px' }} />
    </div>
  );
};

export default FootballTouchTracker;
