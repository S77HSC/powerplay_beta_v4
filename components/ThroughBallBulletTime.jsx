"use client";

import React, { useEffect, useRef, useState } from "react";
// You said your renderer is here:
import { drawWorld as RRDrawWorld } from "./ReactionRushRender";

const W = 960, H = 560, ROUND_MS = 60000;
const DEF_COUNT = 6, DEF_R = 22, BALL_R = 8, RECEIVER_R = 16;

const FOCUS_DRAIN = 0.55;   // per second while holding slow-mo
const FOCUS_REGEN = 0.35;   // per second while not holding
const TIMESCALE_SLOW = 0.35;
const TIMESCALE_NORM = 1.0;

export default function ThroughballBulletTime({ onDone }) {
  const canvasRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [perfects, setPerfects] = useState(0); // for Overdrive
  const [focus, setFocus] = useState(1);
  const [overdrive, setOverdrive] = useState(false);

  const ballRef = useRef({ x: 120, y: H * 0.5, vx: 0, vy: 0, inFlight: false });
  const aimRef  = useRef({ active: false, ax: 0, ay: 0 });
  const mouseRef = useRef({ x: W * 0.35, y: H * 0.5, down: false });

  const defsRef = useRef([]);
  const rxRef = useRef({ x: W - 120, y: H * 0.5, vx: 0, vy: 0 });
  const shakeRef = useRef(0);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const segToPointDist = (x1, y1, x2, y2, px, py) => {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const vv = vx * vx + vy * vy;
    const t = vv === 0 ? 0 : clamp((wx * vx + wy * vy) / vv, 0, 1);
    const cx = x1 + t * vx, cy = y1 + t * vy;
    return { d: dist(px, py, cx, cy), t, cx, cy };
  };

  const resetRound = () => {
    setTimeLeft(ROUND_MS);
    setScore(0);
    setCombo(0);
    setPerfects(0);
    setFocus(1);
    setOverdrive(false);
    ballRef.current = { x: 120, y: H * 0.5, vx: 0, vy: 0, inFlight: false };
    aimRef.current  = { active: false, ax: 0, ay: 0 };
    mouseRef.current = { x: W * 0.35, y: H * 0.5, down: false };
    spawnWave();
  };

  const spawnWave = () => {
    const defs = [];
    for (let i = 0; i < DEF_COUNT; i++) {
      const y = 80 + (i * (H - 160)) / (DEF_COUNT - 1);
      const dir = Math.random() < 0.5 ? -1 : 1;
      defs.push({
        x: W * (0.38 + Math.random() * 0.42),
        y,
        vx: (80 + Math.random() * 100) * dir,
        r: DEF_R,
      });
    }
    defsRef.current = defs;

    const lanes = [H * 0.3, H * 0.45, H * 0.6];
    rxRef.current = {
      x: W - 120,
      y: lanes[Math.floor(Math.random() * lanes.length)],
      vx: 0,
      vy: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30),
    };
  };

  // input
  useEffect(() => {
    const onMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) * (W / rect.width);
      mouseRef.current.y = (e.clientY - rect.top) * (H / rect.height);
      if (aimRef.current.active) {
        aimRef.current.ax = mouseRef.current.x;
        aimRef.current.ay = mouseRef.current.y;
      }
    };
    const onDown = () => {
      if (!running) return;
      if (!ballRef.current.inFlight && focus > 0) {
        aimRef.current.active = true;
        aimRef.current.ax = mouseRef.current.x;
        aimRef.current.ay = mouseRef.current.y;
        mouseRef.current.down = true;
      }
    };
    const onUp = () => {
      mouseRef.current.down = false;
      if (!running) return;
      if (aimRef.current.active && !ballRef.current.inFlight) {
        const bx = ballRef.current.x, by = ballRef.current.y;
        let dx = aimRef.current.ax - bx, dy = aimRef.current.ay - by;
        const len = Math.max(1, Math.hypot(dx, dy));
        dx /= len; dy /= len;
        const speed = 700;
        ballRef.current.vx = dx * speed;
        ballRef.current.vy = dy * speed;
        ballRef.current.inFlight = true;
      }
      aimRef.current.active = false;
    };

    const c = canvasRef.current;
    c.addEventListener("mousemove", onMove);
    c.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    // touch
    const tstart = (e) => { const t = e.touches[0]; onMove(t); onDown(); };
    const tmove  = (e) => { const t = e.touches[0]; onMove(t); };
    const tend   = () => onUp();

    c.addEventListener("touchstart", tstart, { passive: true });
    c.addEventListener("touchmove",  tmove,  { passive: true });
    c.addEventListener("touchend",   tend);

    return () => {
      c.removeEventListener("mousemove", onMove);
      c.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      c.removeEventListener("touchstart", tstart);
      c.removeEventListener("touchmove",  tmove);
      c.removeEventListener("touchend",   tend);
    };
  }, [running, focus]);

  // main loop
  useEffect(() => {
    let raf = 0, last = 0;

    const loop = (t) => {
      if (!running) return;
      if (!last) last = t;
      const rawDt = (t - last) / 1000; last = t;

      const wantSlow = ((aimRef.current.active && mouseRef.current.down) || overdrive) && focus > 0;
      const ts = wantSlow ? TIMESCALE_SLOW : TIMESCALE_NORM;
      const dt = rawDt * ts;

      // focus meter (based on real time)
      setFocus((f) => wantSlow ? clamp(f - FOCUS_DRAIN * rawDt, 0, 1) : clamp(f + FOCUS_REGEN * rawDt, 0, 1));

      // countdown uses real time
      setTimeLeft((ms) => {
        const n = Math.max(0, ms - rawDt * 1000);
        if (n === 0) endRun();
        return n;
      });

      update(dt);
      draw(ts);

      raf = requestAnimationFrame(loop);
    };

    if (running) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, overdrive, focus]);

  const update = (dt) => {
    // defenders
    for (const d of defsRef.current) {
      d.x += d.vx * dt;
      if (d.x < W * 0.25 + d.r) { d.x = W * 0.25 + d.r; d.vx *= -1; }
      if (d.x > W * 0.85 - d.r) { d.x = W * 0.85 - d.r; d.vx *= -1; }
    }
    // receiver
    const rx = rxRef.current;
    rx.y += rx.vy * dt;
    if (rx.y < 80) { rx.y = 80; rx.vy *= -1; }
    if (rx.y > H - 80) { rx.y = H - 80; rx.vy *= -1; }

    // ball flight & collisions
    const ball = ballRef.current;
    if (ball.inFlight) {
      const steps = 3, sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const nx = ball.x + ball.vx * sdt;
        const ny = ball.y + ball.vy * sdt;

        // block by defenders
        for (const d of defsRef.current) {
          const { d: segd } = segToPointDist(ball.x, ball.y, nx, ny, d.x, d.y);
          if (segd <= d.r + BALL_R) {
            ball.inFlight = false; ball.vx = ball.vy = 0;
            shakeRef.current = 10; setCombo(0); setPerfects(0);
            setScore((s) => Math.max(0, s - 3));
            ball.x = ball.x - 6; // tiny knock-back
            return;
          }
        }

        // reached receiver x?
        if (nx > rx.x - 10) {
          let minGap = Infinity;
          for (const d of defsRef.current) {
            const { d: pd } = segToPointDist(ballRef.current.x, ballRef.current.y, rx.x, rx.y, d.x, d.y);
            minGap = Math.min(minGap, pd - d.r);
          }
          const tight = minGap; // px to nearest defender edge
          const base = 10;
          let bonus = 0;
          if (tight < 12)      bonus = 20;
          else if (tight < 18) bonus = 12;
          else if (tight < 26) bonus = 6;

          const gain = base + bonus + Math.floor(combo * 1.5);
          setScore((s) => s + gain);
          const newCombo = combo + 1;
          setCombo(newCombo);
          if (bonus >= 12) setPerfects((p) => p + 1);
          if (perfects + (bonus >= 12 ? 1 : 0) >= 3) {
            setOverdrive(true);
            setTimeout(() => setOverdrive(false), 4000);
          }

          ball.inFlight = false; ball.vx = ball.vy = 0;
          ball.x = 120; ball.y = H * 0.5;
          spawnWave();
          return;
        }

        ball.x = nx; ball.y = ny;
      }
    }

    shakeRef.current = Math.max(0, shakeRef.current - 60 * dt);
  };

  const draw = (ts) => {
    const c = canvasRef.current, ctx = c.getContext("2d");

    // background
    ctx.clearRect(0, 0, W, H);
    try {
      RRDrawWorld?.(c, { W, H }, { particles: [], texts: [], goalT: 0 }, { x: -999, y: -999, r: 0 }, { view3D: false });
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W, H);
    } catch {
      ctx.fillStyle = "#0b3a2e"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.beginPath(); ctx.arc(W/2, H/2, 70, 0, Math.PI*2); ctx.stroke();
    }

    if (shakeRef.current > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
    }

    // defenders
    for (const d of defsRef.current) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,50,50,0.95)";
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
    }

    // receiver
    const rx = rxRef.current;
    ctx.beginPath();
    ctx.fillStyle = "rgba(80,200,255,0.95)";
    ctx.arc(rx.x, rx.y, RECEIVER_R, 0, Math.PI * 2);
    ctx.fill();

    // aim laser
    const ball = ballRef.current;
    if (aimRef.current.active && !ball.inFlight && focus > 0) {
      ctx.save(); ctx.globalAlpha = 0.9;
      const bx = ball.x, by = ball.y;
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aimRef.current.ax, aimRef.current.ay); ctx.stroke();

      const dx = aimRef.current.ax - bx, dy = aimRef.current.ay - by;
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(aimRef.current.ax, aimRef.current.ay);
      ctx.lineTo(aimRef.current.ax - 10 * Math.cos(ang - 0.4), aimRef.current.ay - 10 * Math.sin(ang - 0.4));
      ctx.lineTo(aimRef.current.ax - 10 * Math.cos(ang + 0.4), aimRef.current.ay - 10 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fill();
      ctx.restore();
    }

    // ball
    ctx.beginPath();
    ctx.fillStyle = "#ffe18a";
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.stroke();

    if (shakeRef.current > 0) ctx.restore();

    // HUD
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 58);

    ctx.fillStyle = "#fff"; ctx.font = "900 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";   ctx.fillText(`Score ${score}`, 18, 36);
    ctx.textAlign = "center"; ctx.fillText(`${Math.ceil(timeLeft / 1000)}s`, W / 2, 36);
    ctx.textAlign = "right";  ctx.fillText(`Combo x${combo}`, W - 18, 36);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(18, 10, 200, 6);
    ctx.fillStyle = overdrive ? "#f59e0b" : "#22d3ee";
    ctx.fillRect(18, 10, 200 * clamp(focus, 0, 1), 6);

    if ((aimRef.current.active && mouseRef.current.down && focus > 0) || overdrive) {
      ctx.fillStyle = overdrive ? "#f59e0b" : "#22d3ee";
      ctx.font = "800 14px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(overdrive ? "OVERDRIVE" : "BULLET TIME", W / 2, 18);
    }
    ctx.restore();
  };

  const endRun = () => {
    setRunning(false);
    onDone?.({ score, comboBest: combo });
  };

  return (
    <div className="grid place-items-center gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-xl border border-white/10 bg-black/20"
        style={{ touchAction: "none" }}
      />
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            onClick={() => { resetRound(); setRunning(true); }}
            className="rounded-xl bg-yellow-400 px-5 py-2 text-black font-bold hover:brightness-95"
          >
            Start • Throughball: Bullet Time
          </button>
        ) : (
          <>
            <button onClick={endRun} className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/20">End</button>
            <button onClick={resetRound} className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/20">Restart</button>
          </>
        )}
      </div>
      <p className="text-white/70 text-sm max-w-xl text-center">
        Hold to slow time (uses Focus). Drag to set the throughball angle. Release to pass. Thread tight gaps for big points.
        Chain perfect threads to trigger <span className="text-yellow-300 font-bold">Overdrive</span>.
      </p>
    </div>
  );
}
