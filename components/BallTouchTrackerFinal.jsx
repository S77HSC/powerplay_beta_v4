import { useEffect, useRef, useState } from 'react';

export default function BallTouchTrackerFinal({
  isActive = false,
  onTouchChange,
  onPermissionError,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [touches, setTouches] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const ballProfile = useRef(null);
  const prevFrame = useRef(null);
  const prevBall = useRef(null);
  const directionRef = useRef(null);
  const audioRef = useRef(null);

  // report touches to parent
  useEffect(() => {
    if (typeof onTouchChange === 'function') onTouchChange(touches);
  }, [touches, onTouchChange]);

  // Start/stop camera stream based on isActive
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!isActive) return;
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          // set canvas size from video
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
        }
      } catch (err) {
        console.warn('getUserMedia error:', err);
        onPermissionError?.(err);
      }
    }

    // start if not started
    if (isActive && !streamRef.current) start();

    // stop when inactive
    if (!isActive && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [isActive, onPermissionError]);

  // Animation / detection loop (runs only while active)
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg');

    let frameCount = 0;

    function update() {
      rafRef.current = requestAnimationFrame(update);
      if (!isActive) return;

      // draw current frame
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        return;
      }

      const zoneYStart = Math.floor(canvas.height * 0.75);
      const zoneHeight = Math.floor(canvas.height * 0.25);

      // detection zone decoration
      ctx.beginPath();
      ctx.rect(0, zoneYStart, canvas.width, zoneHeight);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      frameCount++;
      if (frameCount % 2 !== 0) return; // skip every other frame for perf

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;
      const motionPoints = [];

      if (prevFrame.current) {
        const prev = prevFrame.current.data;
        for (let y = zoneYStart; y < canvas.height; y += 2) {
          for (let x = 0; x < canvas.width; x += 2) {
            const i = (y * canvas.width + x) * 4;
            const dr = Math.abs(data[i] - prev[i]);
            const dg = Math.abs(data[i + 1] - prev[i + 1]);
            const db = Math.abs(data[i + 2] - prev[i + 2]);
            if (dr + dg + db > 70) motionPoints.push({ x, y });
          }
        }
      }
      prevFrame.current = frame;

      if (motionPoints.length > 30) {
        const xs = motionPoints.map((p) => p.x);
        const ys = motionPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const radius = Math.max(maxX - minX, maxY - minY) / 2;

        if (radius > 10 && radius < 50) {
          const i = (Math.floor(cy) * canvas.width + Math.floor(cx)) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];

          let colorMatch = true;
          if (calibrated && ballProfile.current) {
            const { r: br, g: bg, b: bb } = ballProfile.current;
            const tol = 40;
            colorMatch = Math.abs(r - br) < tol && Math.abs(g - bg) < tol && Math.abs(b - bb) < tol;
          }

          if (colorMatch) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.stroke();

            if (prevBall.current) {
              const dx = cx - prevBall.current.x;
              const newDir = dx > 0 ? 'right' : 'left';
              if (directionRef.current && directionRef.current !== newDir && Math.abs(dx) > 8) {
                setTouches((t) => t + 1);
                try { audioRef.current?.play(); } catch {}
              }
              directionRef.current = newDir;
            }
            prevBall.current = { x: cx, y: cy };
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isActive, calibrated]);

  const handleCalibrate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let y = Math.floor(canvas.height * 0.75); y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const i = (y * canvas.width + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
      }
    }
    ballProfile.current = { r: r / count, g: g / count, b: b / count };
    setCalibrated(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      <video ref={videoRef} style={{ display: 'none' }} />
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: '2px solid #444',
            borderRadius: '0.5rem',
          }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={handleCalibrate} disabled={!isActive} title={!isActive ? 'Start training to calibrate' : 'Calibrate'}>
          Calibrate Ball
        </button>
        <span><strong>Touches:</strong> {touches}</span>
      </div>
    </div>
  );
}
