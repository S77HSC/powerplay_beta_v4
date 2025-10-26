import { useEffect, useRef, useState } from "react";

export default function BallTouchTrackerFinal() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [touches, setTouches] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const ballProfile = useRef(null);
  const prevFrame = useRef(null);
  const prevBall = useRef(null);
  const directionRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");
    audioRef.current = audio;

    let frameCount = 0;

    const updateBall = () => {
      frameCount++;
      if (frameCount % 2 !== 0) {
        requestAnimationFrame(updateBall);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const zoneYStart = canvas.height * 0.75;
      const zoneHeight = canvas.height * 0.25;

      // Draw detection zone
      ctx.beginPath();
      ctx.rect(0, zoneYStart, canvas.width, zoneHeight);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
      ctx.fill();

      // Label
      ctx.font = "bold 20px 'Segoe UI', 'Helvetica Neue', sans-serif";
      ctx.fillStyle = "#00ff88";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText("Detection Zone", 12, zoneYStart - 12);
      ctx.shadowColor = "transparent";

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;

      let motionPoints = [];
      if (prevFrame.current) {
        const prevData = prevFrame.current.data;
        for (let y = zoneYStart; y < canvas.height; y += 2) {
          for (let x = 0; x < canvas.width; x += 2) {
            const i = (y * canvas.width + x) * 4;
            const dr = Math.abs(data[i] - prevData[i]);
            const dg = Math.abs(data[i + 1] - prevData[i + 1]);
            const db = Math.abs(data[i + 2] - prevData[i + 2]);
            const diff = dr + dg + db;
            if (diff > 70) motionPoints.push({ x, y });
          }
        }
      }

      prevFrame.current = frame;

      if (motionPoints.length > 30) {
        const minX = Math.min(...motionPoints.map(p => p.x));
        const maxX = Math.max(...motionPoints.map(p => p.x));
        const minY = Math.min(...motionPoints.map(p => p.y));
        const maxY = Math.max(...motionPoints.map(p => p.y));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const radius = Math.max(maxX - minX, maxY - minY) / 2;

        if (radius > 10 && radius < 50) {
          const i = (Math.floor(cy) * canvas.width + Math.floor(cx)) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          let colorMatch = true;
          if (calibrated && ballProfile.current) {
            const { r: br, g: bg, b: bb } = ballProfile.current;
            const tolerance = 40;
            colorMatch = Math.abs(r - br) < tolerance &&
                         Math.abs(g - bg) < tolerance &&
                         Math.abs(b - bb) < tolerance;
          }

          if (colorMatch) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 3;
            ctx.stroke();

            if (prevBall.current) {
              const dx = cx - prevBall.current.x;
              const newDirection = dx > 0 ? "right" : "left";
              if (
                directionRef.current &&
                directionRef.current !== newDirection &&
                Math.abs(dx) > 8
              ) {
                setTouches(t => t + 1);
                audioRef.current?.play();
              }
              directionRef.current = newDirection;
            }
            prevBall.current = { x: cx, y: cy };
          }
        }
      }

      requestAnimationFrame(updateBall);
    };

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      video.srcObject = stream;
      video.play();
      video.onloadedmetadata = () => {
        // Set canvas dimensions based on video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        requestAnimationFrame(updateBall);
      };
    });
  }, [calibrated]);

  const handleCalibrate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
    for (let y = canvas.height * 0.75; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const i = (y * canvas.width + x) * 4;
        rTotal += data[i];
        gTotal += data[i + 1];
        bTotal += data[i + 2];
        count++;
      }
    }
    ballProfile.current = {
      r: rTotal / count,
      g: gTotal / count,
      b: bTotal / count
    };
    setCalibrated(true);
  };

  return (
    <div style={{ textAlign: "center" }}>
      <video ref={videoRef} style={{ display: "none" }} />
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3" }}>
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "2px solid #444",
            borderRadius: "0.5rem"
          }}
        />
      </div>
      <div style={{ marginTop: "12px" }}>
        <button onClick={handleCalibrate}>Calibrate Ball</button>
        <p><strong>Touches:</strong> {touches}</p>
      </div>
    </div>
  );
}
