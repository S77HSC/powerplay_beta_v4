'use client';

import React, { useEffect, useRef, useState } from 'react';
import { drawWorld, warmSprites } from './ReactionRushRender';

/** Page background (RR logo behind the whole page) */
function RRPageBackground() {
  return (
    <>
      <style>{`
        .rr-page-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(120% 90% at 50% 0%, #0b1020 0%, #060914 70%); }
        .rr-page-bg::before { content: ""; position:absolute; inset:0;
          background-image: url("/reaction-rush/rr-icon.png");
          background-repeat:no-repeat; background-position:center 22vh;
          background-size:min(88vmin, 720px); opacity:0.20;
          filter: drop-shadow(0 0 40px rgba(59,130,246,0.45));
          animation: rrPulse 18s ease-in-out infinite; will-change: transform, opacity; }
        .rr-page-bg::after { content:""; position:absolute; left:50%; top:38%;
          width:min(80vmin, 720px); height:min(80vmin, 720px); transform:translate(-50%,-50%);
          background: radial-gradient(closest-side, rgba(59,130,246,0.22), rgba(59,130,246,0) 70%);
          filter: blur(2px); opacity:0.6; }
        @keyframes rrPulse { 0%{ transform:translateY(-1vh) scale(1); opacity:0.18; }
          50%{ transform:translateY(1vh) scale(1.02); opacity:0.22; }
          100%{ transform:translateY(-1vh) scale(1); opacity:0.18; } }
      `}</style>
      <div className="rr-page-bg" aria-hidden="true" />
    </>
  );
}

/** Neon bezel that sits ON TOP of the canvas (no clicks intercepted) */
function RRCanvasFrame() {
  return (
    <>
      <style>{`
        .rr-bezel { position:absolute; inset:0; pointer-events:none; border-radius:16px; z-index:22; }
        .rr-bezel::before {
          content:""; position:absolute; inset:0; border-radius:16px;
          box-shadow:
            inset 0 0 0 2px rgba(59,130,246,0.45),
            inset 0 0 36px rgba(59,130,246,0.35),
            inset 0 -60px 120px rgba(255,255,255,0.06);
          background:
            radial-gradient(140% 100% at 50% 0%, rgba(255,255,255,0.05), rgba(0,0,0,0) 60%),
            linear-gradient(120deg, rgba(59,130,246,0.10), rgba(168,85,247,0.08), rgba(59,130,246,0.10));
          mix-blend-mode: screen;
        }
        .rr-corner { position:absolute; width:18px; height:18px; border-radius:50%;
          background: radial-gradient(circle at 30% 30%, #8fb8ff 0%, #2b5ac7 40%, #0b1020 70%);
          box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 16px rgba(59,130,246,0.55);
          opacity:0.9; }
        .rr-corner::after { content:""; position:absolute; inset:3px; border-radius:50%;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45); }
        .rr-tl { left:8px; top:8px; } .rr-tr{ right:8px; top:8px; }
        .rr-bl { left:8px; bottom:8px; } .rr-br{ right:8px; bottom:8px; }
        .rr-bezel::after { content:""; position:absolute; inset:-1px; border-radius:18px;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.2), 0 0 40px rgba(59,130,246,0.25); }
      `}</style>
      <div className="rr-bezel" aria-hidden="true">
        <div className="rr-corner rr-tl" />
        <div className="rr-corner rr-tr" />
        <div className="rr-corner rr-bl" />
        <div className="rr-corner rr-br" />
      </div>
    </>
  );
}

// ---------- small utils ----------
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const clampDt = (dt) => Math.min(dt, 32);
const rand = (min, max) => Math.random() * (max - min) + min;
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; };

// --------- Keyboard (no scroll hijack) ---------
function useKeyboard() {
  const keys = useRef(new Set());
  useEffect(() => {
    const block = new Set(['arrowup','arrowdown','arrowleft','arrowright',' ']);
    const isTyping = (el) =>
      el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(el.tagName));
    const down = (e) => { if (isTyping(e.target)) return; const k=(e.key||'').toLowerCase(); if (block.has(k)) e.preventDefault(); keys.current.add(k); };
    const up   = (e) => { if (isTyping(e.target)) return; const k=(e.key||'').toLowerCase(); if (block.has(k)) e.preventDefault(); keys.current.delete(k); };
    window.addEventListener('keydown', down, { passive:false });
    window.addEventListener('keyup', up, { passive:false });
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}
function useRaf(onFrame, running) {
  const rafRef = useRef(0), lastRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    let mounted = true;
    const loop = (t) => { if (!mounted) return; if (!lastRef.current) lastRef.current = t; const dt = t - lastRef.current; lastRef.current = t; onFrame(dt); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(rafRef.current); };
  }, [onFrame, running]);
}

// -------------- Game constants --------------
const FIELD_W = 960, FIELD_H = 560;
const ROUND_TIME = 60_000;
const PRESETS = {
  easy:   { baseSpeed: 0.10, maxDef: 7,  spawnEvery: 1800, slowRadius: 140, hitboxScale: 0.82, pickupMagnet: 1.6,  maxMul: 1.25 },
  normal: { baseSpeed: 0.12, maxDef: 10, spawnEvery: 1600, slowRadius: 110, hitboxScale: 0.88, pickupMagnet: 1.45, maxMul: 1.40 },
  hard:   { baseSpeed: 0.14, maxDef: 12, spawnEvery: 1400, slowRadius:  90, hitboxScale: 0.95, pickupMagnet: 1.30, maxMul: 1.55 },
};
const FREEZE_DURATION = 3500;
const ICE_CD_MIN = 8000, ICE_CD_VAR = 6000;
const POWERPLAY_DURATION = 5000;
const DYNAMITE_RESPAWN_DELAY = 5000;
const MEDKIT_MIN = 12000, MEDKIT_VAR = 10000, MEDKIT_CHANCE = 0.9;

// Combos
const COMBO_WINDOW = 2400;
const COMBO_TIERS = [
  { n: 3,  bonus: 1, label: 'Streak' },
  { n: 5,  bonus: 2, label: 'Heated' },
  { n: 8,  bonus: 4, label: 'On Fire' },
  { n: 12, bonus: 8, label: 'Unstoppable' },
];
const comboBonus = (n) => { let b=0; for (const t of COMBO_TIERS) if (n>=t.n) b=t.bonus; return b; };

const GOAL_OPENING = 160;
const ZONE_LIFE = 10000, ZONE_R = 50;
const ZONE_TYPES = ['speed','invincible','shot'];

/** Dynamic difficulty: speed up at 100 & 200, +1 defender at 200, then every 50 (250, 300, 350, …) */
function computeDifficulty(score) {
  let steps = 0;
  if (score >= 100) steps += 1;
  if (score >= 200) steps += 1 + Math.floor((score - 200) / 50);
  const extraDef = (score >= 200) ? (1 + Math.floor((score - 200) / 50)) : 0;
  return { steps, speedMul: 1 + steps*0.06, extraDef };
}

// ---------- Mobile controls ----------
function useMobileControls() {
  const [vec, setVec] = useState({ x: 0, y: 0, active: false });
  const dashRef = useRef(false); const shootRef = useRef(false);
  const [showMobile, setShowMobile] = useState(false);
  const R = 62;
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const forced = qs.get('mobile') === '1';
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 840;
    const touchCap = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const iOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setShowMobile(forced || iOS || coarse || touchCap || isSmall);
  }, []);
  const start = (e) => {
    e.preventDefault();
    const getPt = (ev) => (ev.touches ? ev.touches[0] : ev);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const move = (ev) => { const pt = getPt(ev); const dx = pt.clientX - cx, dy = pt.clientY - cy; const len = Math.hypot(dx,dy); const m = len > R ? R/len : 1; setVec({ x: dx*m, y: dy*m, active:true }); };
    const end  = () => { setVec({ x:0, y:0, active:false }); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); };
    window.addEventListener('pointermove', move, { passive:false });
    window.addEventListener('pointerup', end, { passive:true });
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', end, { passive:true });
    window.addEventListener('mousemove', move, { passive:false });
    window.addEventListener('mouseup', end, { passive:true });
    move(e);
  };
  const pressDash = () => { dashRef.current = true; };
  const pressShoot = () => { shootRef.current = true; };
  const consume = () => { const d=dashRef.current, s=shootRef.current; dashRef.current=false; shootRef.current=false; return { dash:d, shoot:s }; };
  const UI = !showMobile ? null : (
    <>
      <div onPointerDown={start} onTouchStart={start} onMouseDown={start} style={{ position:'absolute', left:12, bottom:12, width:140, height:140, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', touchAction:'none', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none', WebkitTapHighlightColor:'transparent', zIndex:1000 }}>
        <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:22, height:22, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
        <div style={{ position:'absolute', left:`calc(50% + ${vec.x}px)`, top:`calc(50% + ${vec.y}px)`, transform:'translate(-50%,-50%)', width:50, height:50, borderRadius:'50%', background:'#3b82f6', border:'1px solid #1e40af', boxShadow:'0 6px 16px rgba(59,130,246,0.5)' }}/>
      </div>
      <div style={{ position:'absolute', right:12, bottom:12, display:'flex', gap:10, zIndex:1000 }}>
        <button onPointerDown={pressDash} onTouchStart={pressDash} onMouseDown={pressDash} style={{ width:82, height:82, borderRadius:'50%', border:'1px solid #22c55e', background:'#22c55e', color:'#062c12', fontWeight:900, WebkitUserSelect:'none', WebkitTouchCallout:'none' }}>Dash</button>
        <button onPointerDown={pressShoot} onTouchStart={pressShoot} onMouseDown={pressShoot} style={{ width:82, height:82, borderRadius:'50%', border:'1px solid #fbbf24', background:'#fbbf24', color:'#3a2a00', fontWeight:900, WebkitUserSelect:'none', WebkitTouchCallout:'none' }}>Shoot</button>
      </div>
    </>
  );
  const dead=14; const up=vec.active&&vec.y<-dead, dn=vec.active&&vec.y>dead, lf=vec.active&&vec.x<-dead, rt=vec.active&&vec.x>dead;
  return { up, dn, lf, rt, UI, consume, showMobile };
}

// ---------------- FX helpers ----------------
function spawnBurst(g, x, y, color = '#ffcc00', n = 28) { for (let i=0;i<n;i++){ const ang=Math.random()*Math.PI*2; const sp=0.06+Math.random()*0.22; g.particles.push({ type:'spark', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:600+Math.random()*400, max:800, col:color }); } }
function spawnCoinBurst(g, x, y, n = 16) { for (let i=0;i<n;i++){ const ang=Math.random()*Math.PI*2; const sp=0.10+Math.random()*0.24; g.particles.push({ type:'coin', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:900, max:900, rot:Math.random()*Math.PI*2, r:4+Math.random()*2 }); } }
function spawnShockwave(g, x, y, color='#f87171', thick=5, dur=650){ g.particles.push({ type:'ring', x,y, life:dur, max:dur, color, thick }); }
function spawnWebPulse(g, x, y, lines=8, dur=700){ g.particles.push({ type:'web', x,y, life:dur, max:dur, lines }); }
function spawnDefenderGibs(g, d){ for (let i=0;i<12;i++){ const ang=Math.random()*Math.PI*2; const sp=0.08+Math.random()*0.20; g.particles.push({ type:'gib', x:d.x, y:d.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:800+Math.random()*400, max:1000, r:3+Math.random()*3, col:'#e11d48' }); } }
function spawnConfetti(g, x, y, n=50){ for (let i=0;i<n;i++){ const ang=Math.random()*Math.PI*2, sp=0.10+Math.random()*0.25; const col=['#22c55e','#3b82f6','#fbbf24','#ef4444','#a78bfa'][Math.floor(Math.random()*5)]; g.particles.push({ type:'confetti', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:1000+Math.random()*400, max:1400, col, r:2+Math.random()*2, rot:Math.random()*6.28 }); } }

// -------------- Component --------------
export default function ReactionRush() {
  const canvasRef = useRef(null);
  const keys = useKeyboard();
  useEffect(() => { warmSprites(); }, []);

  const [preset, setPreset] = useState('easy');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1);
  const [moveScale, setMoveScale] = useState(0.30);
  const [view3D, setView3D] = useState(true); // <<< NEW: 3D camera tilt

  const [gameMode, setGameMode] = useState('survival');
  const [lives, setLives] = useState(5);

  const [timeLeft, setTimeLeft]   = useState(ROUND_TIME);
  const [collected, setCollected] = useState(0);
  const [best, setBest]           = useState(0);

  const mobile = useMobileControls();
  const dims = { W: FIELD_W, H: FIELD_H };

  const stateRef = useRef({
    player: { x: 0, y: 0, r: 11, invuln: 0, vx: 0, vy: 0 },
    defenders: [], balls: [], particles: [], trail: [], texts: [],
    lastSpawn: 0, shake: 0, freezeT: 0, iceCd: ICE_CD_MIN,
    dash: { ready: true, t: 0, cooldown: false },
    powerplayT: 0, dynamiteCooldown: 0, playerGlowT: 0, slowmoT: 0,
    borderPulse: null, carryBall: null, goalT: 0,
    medkitCd: MEDKIT_MIN + Math.random()*MEDKIT_VAR,
    zones: [], boostT: 0, shotBuffT: 0,
    comboCount: 0, comboT: 0, comboBest: 0,
    difficultySteps: 0,
  });

  // Fit canvas (slightly smaller than full)
  useEffect(() => {
    const onResize = () => {
      const W = dims.W, H = dims.H;
      const vw = window.innerWidth, vh = window.innerHeight;
      const scaleW = vw / W, scaleH = (vh - 80) / H;
      const SCALE_BIAS = 0.94;
      setScale(clamp(Math.min(scaleW, scaleH) * SCALE_BIAS, 0.5, 1.2));
    };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, [dims.W, dims.H]);

  const makeDefender = (D, cfg) => {
    const y = rand(60, D.H - 60); const dir = Math.random() < 0.5 ? -1 : 1;
    const px = stateRef.current.player?.x ?? D.W * 0.1;
    let x = rand(D.W * 0.3, D.W * 0.9);
    if (Math.abs(x - px) < 180) x = px + (x < px ? -1 : 1) * 180;
    x = clamp(x, 40, D.W - 40);
    const types = ['h','v','diag','orbit','seek','wander'];
    const type = types[Math.floor(Math.random()*types.length)];
    return { x, y, r: 16, speed: PRESETS[preset].baseSpeed * rand(0.85, 1.15), dir, type, theta: 0, cx: x, cy: y, radius: 80 + Math.random()*60, vx: 0, vy: 0, changeIn: 1200 + Math.random()*1000, _W: D.W, _H: D.H };
  };

  const spawnZonesForPossession = (g) => {
    const sideRight = g.player.x < dims.W/2;
    const xBase = sideRight ? dims.W*0.76 : dims.W*0.24;
    const genZone = (type) => ({ type, x: clamp(xBase + rand(-80,80), 60, dims.W-60), y: clamp(dims.H*0.3 + rand(-90,90), 60, dims.H-60), r: ZONE_R, life: ZONE_LIFE, pulse: Math.random()*1000, used:false });
    [...ZONE_TYPES].sort(()=>Math.random()-0.5).slice(0,2).forEach(t=>g.zones.push(genZone(t)));
  };

  const resetGame = () => {
    const g = stateRef.current;
    g.player = { x: dims.W*0.2, y: dims.H*0.5, r: 11, invuln: 0, vx: 0, vy: 0 };
    g.defenders = []; for (let i=0;i<6;i++) g.defenders.push(makeDefender(dims, PRESETS[preset]));
    g.defenders.forEach(d => { d._W=dims.W; d._H=dims.H; d.frozenT=0; });
    g.particles=[]; g.trail=[]; g.texts=[]; g.lastSpawn=0; g.shake=0;
    g.freezeT=0; g.iceCd=ICE_CD_MIN + Math.random()*ICE_CD_VAR;
    g.dash={ ready:true, t:0, cooldown:false };
    g.balls=[]; g.powerplayT=0; g.dynamiteCooldown=0; g.playerGlowT=0; g.slowmoT=0; g.borderPulse=null; g.carryBall=null; g.goalT=0;
    g.medkitCd=MEDKIT_MIN + Math.random()*MEDKIT_VAR; g.zones=[]; g.boostT=0; g.shotBuffT=0;
    g.comboCount=0; g.comboT=0; g.comboBest=0; g.difficultySteps=0;
    setLives(5); setCollected(0); setTimeLeft(ROUND_TIME); setPaused(false); setRunning(true);
  };

  useRaf((raw) => {
    if (!running || paused) return;
    const dt = clampDt(raw);
    const g = stateRef.current, p = g.player; const cfg = PRESETS[preset];

    const diff = computeDifficulty(collected);
    const cfg2 = { ...cfg, baseSpeed: cfg.baseSpeed * diff.speedMul, maxDef: cfg.maxDef + diff.extraDef, spawnEvery: cfg.spawnEvery / diff.speedMul };

    setTimeLeft((t)=>clamp(t-dt, 0, ROUND_TIME));
    g.freezeT=Math.max(0,(g.freezeT||0)-dt); g.iceCd=Math.max(0,(g.iceCd||0)-dt);
    g.powerplayT=Math.max(0,(g.powerplayT||0)-dt); g.dynamiteCooldown=Math.max(0,(g.dynamiteCooldown||0)-dt);
    g.playerGlowT=Math.max(0,(g.playerGlowT||0)-dt); g.slowmoT=Math.max(0,(g.slowmoT||0)-dt);
    g.goalT=Math.max(0,(g.goalT||0)-dt); g.shake=Math.max(0,(g.shake||0)-dt*0.035);
    g.medkitCd=Math.max(0,(g.medkitCd||0)-dt); g.boostT=Math.max(0,(g.boostT||0)-dt); g.shotBuffT=Math.max(0,(g.shotBuffT||0)-dt);
    g.comboT=Math.max(0,(g.comboT||0)-dt); if (g.comboT===0 && g.comboCount>0) g.comboCount=0;
    g.zones.forEach(z=>{ z.life-=dt; z.pulse+=dt; }); g.zones=g.zones.filter(z=>z.life>0 && !z.used);
    if (g.borderPulse){ g.borderPulse.t=Math.max(0,g.borderPulse.t-dt); if (g.borderPulse.t<=0) g.borderPulse=null; }

    const timeScale = (g.slowmoT>0) ? 0.45 : 1.0;
    const speedMult = (g.boostT>0) ? 1.6 : 1.0;
    const dtMove = dt * moveScale * timeScale * speedMult;

    g.lastSpawn += dt;
    if (g.lastSpawn > cfg2.spawnEvery) {
      g.lastSpawn = 0; const sx=rand(dims.W*0.2,dims.W*0.95), sy=rand(50,dims.H-50);
      if (g.iceCd<=0 && Math.random()<0.5){ g.iceCd = ICE_CD_MIN + Math.random()*ICE_CD_VAR; g.balls.push({ x:sx, y:sy, r:11, type:'ice', value:1 }); }
      else {
        const roll=Math.random();
        if (roll<0.10) g.balls.push({ x:sx, y:sy, r:12, type:'gold', value:0 });
        else if (roll<0.18) g.balls.push({ x:sx, y:sy, r:12, type:'powerplay', value:0 });
        else if (roll<0.24) g.balls.push({ x:sx, y:sy, r:13, type:'dynamite', value:0 });
        else if (roll<0.40) g.balls.push({ x:sx, y:sy, r:9, type:'dribble', value:0 });
        else { const r2=Math.random(); const spec = r2<0.55?{r:7,value:1}: r2<0.85?{r:10,value:2}:{r:13,value:3}; g.balls.push({ x:sx,y:sy,...spec,type:'normal' }); }
      }
    }
    if (gameMode==='survival' && g.medkitCd<=0){ g.medkitCd=MEDKIT_MIN+Math.random()*MEDKIT_VAR; if (lives<5 && Math.random()<MEDKIT_CHANCE){ const mx=rand(dims.W*0.15,dims.W*0.85), my=rand(60,dims.H-60); g.balls.push({ x:mx,y:my,r:13,type:'medkit',value:0 }); } }

    const targetMax = cfg2.maxDef;
    if ((g.difficultySteps||0)<diff.extraDef){ for (let i=(g.difficultySteps||0); i<diff.extraDef; i++){ if (g.dynamiteCooldown===0) g.defenders.push(makeDefender(dims,cfg2)); } g.difficultySteps=diff.extraDef; }
    if (g.defenders.length<targetMax && g.dynamiteCooldown===0 && Math.random()<0.003) g.defenders.push(makeDefender(dims,cfg2));
    if (g.dynamiteCooldown===0 && g.defenders.length===0){ for (let i=0;i<targetMax;i++) g.defenders.push(makeDefender(dims,cfg2)); }

    const k=keys.current;
    const up = k.has('w')||k.has('arrowup')||mobile.up;
    const dn = k.has('s')||k.has('arrowdown')||mobile.dn;
    const lf = k.has('a')||k.has('arrowleft')||mobile.lf;
    const rt = k.has('d')||k.has('arrowright')||mobile.rt;
    const { dash:dashTouch, shoot:shootTouch } = mobile.consume();
    const dashPressed = dashTouch || k.has('shift');
    const shootPressed = shootTouch || k.has(' ');

    const PLAYER_MAX_SPEED=1.95, PLAYER_ACCEL=0.0105, PLAYER_FRICTION=0.0032, DASH_SPEED=3.0, DASH_DURATION=420;
    let dash = g.dash;
    const ix=((rt?1:0)-(lf?1:0)), iy=((dn?1:0)-(up?1:0));
    p.vx += ix*PLAYER_ACCEL*dtMove; p.vy += iy*PLAYER_ACCEL*dtMove;
    const hasInput = ix!==0 || iy!==0;
    const reversingX = ix && Math.sign(ix)!==Math.sign(p.vx);
    const reversingY = iy && Math.sign(iy)!==Math.sign(p.vy);
    let frMult=1.0; if(!hasInput) frMult=1.35; if(reversingX||reversingY) frMult=1.9;
    const spdArc=Math.hypot(p.vx,p.vy); if (spdArc>0){ const decay=Math.max(0,1-(PLAYER_FRICTION*frMult)*dtMove); p.vx*=decay; p.vy*=decay; }
    const dashing = !dash.ready && dash.t>0;
    const top = (dashing?DASH_SPEED:PLAYER_MAX_SPEED) * moveScale * timeScale * speedMult;
    const s2=p.vx*p.vx+p.vy*p.vy, t2=top*top; if(s2>t2){ const m=top/Math.sqrt(s2); p.vx*=m; p.vy*=m; }
    if (dash.ready && dashPressed){ g.dash={ ready:false, t:DASH_DURATION, cooldown:false }; p.invuln=250; p.vx*=1.2; p.vy*=1.2; dash=g.dash; }
    if (!dash.ready){ dash.t=Math.max(0,dash.t-dt); if(dash.t<=0 && !dash.cooldown){ dash.cooldown=true; setTimeout(()=>{ g.dash={ ready:true, t:0, cooldown:false }; }, 2400); } }
    if (p.invuln>0) p.invuln-=dt;
    p.x = clamp(p.x + p.vx*dtMove, 20, dims.W-20); p.y = clamp(p.y + p.vy*dtMove, 20, dims.H-20);

    if (Math.hypot(p.vx,p.vy)>0.6 || dashing){ g.trail.push({ x:p.x, y:p.y, r:p.r, a:0.6 }); if (g.trail.length>14) g.trail.shift(); }
    g.trail.forEach(t=>t.a=Math.max(0,t.a-dt/600));

    g.defenders.forEach((d)=>{ // AI
      if (d.frozenT && d.frozenT>0){ d.frozenT=Math.max(0,d.frozenT-dt); return; }
      const px=d.x, py=d.y;
      d.speed += (cfg2.baseSpeed - d.speed)*0.02;
      const sCap = cfg2.baseSpeed * (cfg2.maxMul || 1.4);
      let s = Math.min(d.speed, sCap) * (g.freezeT>0?0:1);
      d.changeIn=(d.changeIn||0)-dt;
      if (d.changeIn<=0){ const types=['h','v','diag','orbit','seek','wander']; if(!d.type||Math.random()<0.5) d.type=types[Math.floor(Math.random()*types.length)]; d.dir=Math.random()<0.5?-1:1; d.theta=d.theta||0; d.cx=d.x; d.cy=d.y; d.radius=d.radius||(60+Math.random()*80); d.vx=d.vx||0; d.vy=d.vy||0; d.changeIn=900+Math.random()*1300; }
      const near = Math.hypot(d.x-p.x,d.y-p.y) < cfg2.slowRadius; if (near) s*=0.7;
      switch(d.type){
        case 'v': d.vx=0; d.vy=d.dir*s; d.y+=d.vy*dt; if(d.y<40||d.y>dims.H-40) d.dir*=-1; break;
        case 'diag':
          if(!d.vx&&!d.vy){ d.vx=d.dir*s; d.vy=(Math.random()<0.5?-1:1)*s; }
          { const sp=Math.hypot(d.vx,d.vy), lim=sCap*1.1; if(sp>lim){ d.vx=d.vx/sp*lim; d.vy=d.vy/sp*lim; } }
          d.x+=d.vx*dt; d.y+=d.vy*dt;
          if(d.x<40||d.x>dims.W-40) d.vx*=-1; if(d.y<40||d.y>dims.H-40) d.vy*=-1; break;
        case 'orbit':
          d.theta=(d.theta||0)+0.002*d.dir*dt;
          d.x=(d.cx||d.x)+Math.cos(d.theta)*(d.radius||100);
          d.y=(d.cy||d.y)+Math.sin(d.theta)*(d.radius||100);
          d.vx=(d.x-px)/(dt||1); d.vy=(d.y-py)/(dt||1); break;
        case 'seek': {
          const tx=p.x, ty=p.y; const ang=Math.atan2(ty-d.y, tx-d.x);
          d.vx=(d.vx||0)+Math.cos(ang)*0.0010*dt; d.vy=(d.vy||0)+Math.sin(ang)*0.0010*dt;
          const sp=Math.hypot(d.vx,d.vy), lim=sCap; if(sp>lim){ d.vx=d.vx/sp*lim; d.vy=d.vy/sp*lim; }
          d.x+=d.vx*dt; d.y+=d.vy*dt; break; }
        case 'wander':
          d.vx=(d.vx||(Math.random()*2-1)*s) + (Math.random()*2-1)*0.0005*dt;
          d.vy=(d.vy||(Math.random()*2-1)*s) + (Math.random()*2-1)*0.0005*dt;
          { const sp=Math.hypot(d.vx,d.vy), lim=sCap*1.1; if(sp>lim){ d.vx=d.vx/sp*lim; d.vy=d.vy/sp*lim; } }
          d.x+=d.vx*dt; d.y+=d.vy*dt; if(d.x<40||d.x>dims.W-40) d.vx*=-1; if(d.y<40||d.y>dims.H-40) d.vy*=-1; break;
        default: d.vx=d.dir*s; d.vy=0; d.x+=d.vx*dt; if(d.x<40||d.x>dims.W-40) d.dir*=-1;
      }
      d.x = clamp(d.x, 20, dims.W-20); d.y = clamp(d.y, 20, dims.H-20);
      if (d.vx===undefined||d.vy===undefined){ d.vx=(d.x-px)/(dt||1); d.vy=(d.y-py)/(dt||1); }
    });

    g.particles.forEach(pt=>{ pt.life-=dt;
      if(pt.type==='coin'){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=0.00035*dt; pt.rot+=0.02*dt; }
      else if(pt.type==='gib'){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=0.00055*dt; }
      else if(pt.type==='spark'){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=0.00045*dt; }
      else if(pt.type==='confetti'){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=0.00065*dt; pt.rot+=0.01*dt; }
    });
    g.particles = g.particles.filter(pt=>pt.life>0);
    g.texts.forEach(t=>{ t.life-=dt; t.y-=0.03*dt; }); g.texts=g.texts.filter(t=>t.life>0);

    const goalTop=(dims.H/2)-(GOAL_OPENING/2), goalBot=(dims.H/2)+(GOAL_OPENING/2);

    if (shootPressed && g.carryBall && g.carryBall.state==='carried'){
      const dirx = (p.vx||p.vy)? p.vx : (p.x < dims.W/2 ? 1 : -1);
      const norm=Math.hypot(dirx,p.vy)||1; const sx=(dirx/norm)*0.7, sy=(p.vy/norm)*0.7;
      g.carryBall={ state:'shot', x:p.x, y:p.y, r:7, vx:sx, vy:sy, life:2200 };
    }

    if (g.carryBall){
      const cb=g.carryBall;
      if (cb.state==='carried'){
        const lead=10; cb.x=p.x+Math.sign(p.vx||1)*lead; cb.y=p.y+Math.sign(p.vy||1)*lead;
        if (p.invuln<=0 && g.powerplayT<=0){
          for (const d of g.defenders){
            if (dist2(d,p) < (((d.r*PRESETS[preset].hitboxScale)+p.r)**2)){
              g.balls.push({ x:cb.x, y:cb.y, r:9, type:'dribble', value:0 }); g.carryBall=null;
              g.texts.push({ x:p.x, y:p.y-12, text:'TACKLED!', col:'#fca5a5', life:800 }); break;
            }
          }
        }
        if (cb.y>goalTop && cb.y<goalBot && (cb.x<=22 || cb.x>=dims.W-22)){
          setCollected(c=>c+10 + (g.shotBuffT>0?5:0)); g.goalT=1200;
          spawnConfetti(g, p.x, p.y); g.borderPulse={ t:800, dur:800, color:'#22c55e' };
          g.texts.push({ x:p.x, y:p.y, text:`GOAL! +${10+(g.shotBuffT>0?5:0)}`, col:'#22c55e', life:1200 });
          g.carryBall=null; g.shotBuffT=0;
        }
      } else if (cb.state==='shot'){
        cb.life-=dt; cb.x+=cb.vx*dt; cb.y+=cb.vy*dt; cb.vx*=0.999; cb.vy*=0.999;
        if (cb.y>goalTop && cb.y<goalBot && (cb.x<=22 || cb.x>=dims.W-22)){
          setCollected(c=>c+10 + (g.shotBuffT>0?5:0)); g.goalT=1200;
          spawnConfetti(g, cb.x, cb.y); g.borderPulse={ t:800, dur:800, color:'#22c55e' };
          g.texts.push({ x:cb.x, y:cb.y, text:`GOAL! +${10+(g.shotBuffT>0?5:0)}`, col:'#22c55e', life:1200 });
          g.carryBall=null; g.shotBuffT=0;
        }
        if (cb.life<=0){ g.balls.push({ x:cb.x, y:cb.y, r:9, type:'dribble', value:0 }); g.carryBall=null; }
      }
    }

    g.balls = g.balls.filter((b)=>{
      if (dist2(b,p) < (((b.r*PRESETS[preset].pickupMagnet)+p.r)**2)){
        const base=b.value||1, bonus=(b.type==='gold')?5:0;
        const eligible=['normal','gold','ice','powerplay','dynamite','dribble','medkit'].includes(b.type);
        if (eligible){ const prev=g.comboCount; g.comboCount=prev+1; g.comboT=COMBO_WINDOW; g.comboBest=Math.max(g.comboBest,g.comboCount); const inc=comboBonus(g.comboCount)-comboBonus(prev);
          if(inc>0){ setCollected(c=>c+inc); g.texts.push({ x:b.x, y:b.y-16, text:`${(COMBO_TIERS.find(t=>t.n<=g.comboCount)||{}).label||'Combo'} +${inc}`, col:'#38bdf8', life:900 }); }
          else { g.texts.push({ x:b.x, y:b.y-16, text:`x${g.comboCount}`, col:'#60a5fa', life:650 }); } }
        if (b.type==='normal'||b.type==='gold') setCollected(c=>c+base+bonus);
        if (b.type==='ice'){ g.freezeT=FREEZE_DURATION; spawnBurst(g,b.x,b.y,'#93c5fd'); g.borderPulse={ t:450,dur:450,color:'#93c5fd' }; g.texts.push({ x:b.x,y:b.y,text:'FREEZE!', col:'#93c5fd', life:900 }); }
        else if (b.type==='gold'){ spawnCoinBurst(g,b.x,b.y); g.playerGlowT=1000; g.borderPulse={ t:400,dur:400,color:'#fbbf24' }; g.texts.push({ x:b.x,y:b.y,text:'+5 XP', col:'#fbbf24', life:900 }); }
        else if (b.type==='powerplay'){ g.powerplayT=POWERPLAY_DURATION; g.slowmoT=500; spawnWebPulse(g,b.x,b.y); g.borderPulse={ t:650,dur:650,color:'#f472b6' }; g.texts.push({ x:b.x,y:b.y,text:'POWERPLAY!', col:'#f472b6', life:900 }); }
        else if (b.type==='dynamite'){ g.dynamiteCooldown=DYNAMITE_RESPAWN_DELAY; spawnShockwave(g,b.x,b.y,'#f87171',6,700); g.borderPulse={ t:700,dur:700,color:'#f87171' }; g.texts.push({ x:b.x,y:b.y,text:'BOOM!', col:'#f87171', life:1000 }); g.defenders.forEach(d=>spawnDefenderGibs(g,d)); g.defenders=[]; }
        else if (b.type==='dribble'){ g.carryBall={ state:'carried', x:b.x, y:b.y, r:7 }; g.texts.push({ x:b.x, y:b.y, text:'POSSESSION!', col:'#22c55e', life:900 }); if (g.zones.length<1) spawnZonesForPossession(g); }
        else if (b.type==='medkit'){ setLives(v=>Math.min(5,v+1)); spawnBurst(g,b.x,b.y,'#34d399'); g.borderPulse={ t:500,dur:500,color:'#34d399' }; g.texts.push({ x:b.x,y:b.y,text:'LIFE +1', col:'#34d399', life:900 }); }
        else { spawnBurst(g,b.x,b.y,'#ffcc00'); g.texts.push({ x:b.x,y:b.y,text:`+${base}`, col:'#ffd60a', life:800 }); }
        g.shake=Math.min((g.shake||0)+2.5,10);
        return false;
      }
      return true;
    });

    g.zones.forEach(z=>{
      if(!z.used && dist2(z,p)<((z.r+p.r)**2)){
        z.used=true;
        if(z.type==='speed'){ g.boostT=3000; g.texts.push({ x:z.x,y:z.y,text:'SPEED +', col:'#22d3ee', life:900 }); g.borderPulse={ t:500,dur:500,color:'#22d3ee' }; }
        else if(z.type==='invincible'){ p.invuln=Math.max(p.invuln,3000); g.texts.push({ x:z.x,y:z.y,text:'INVINCIBLE', col:'#eab308', life:900 }); g.borderPulse={ t:500,dur:500,color:'#eab308' }; }
        else if(z.type==='shot'){ setCollected(c=>c+3); g.shotBuffT=3000; g.texts.push({ x:z.x,y:z.y,text:'SHOT ZONE +3', col:'#a78bfa', life:900 }); g.borderPulse={ t:500,dur:500,color:'#a78bfa' }; }
      }
    });

    let hit=false, hitIdx=-1;
    if (p.invuln<=0){
      for(let i=0;i<g.defenders.length;i++){ const d=g.defenders[i]; if (dist2(d,p)<(((d.r*PRESETS[preset].hitboxScale)+p.r)**2)){ hit=true; hitIdx=i; break; } }
    }
    if (hit){
      p.invuln=800; g.shake=Math.min((g.shake||0)+6,14); g.comboCount=0; g.comboT=0;
      if (g.powerplayT>0 && hitIdx>=0){ const d=g.defenders[hitIdx]; d.frozenT=5000; spawnBurst(g,d.x,d.y,'#a78bfa',20); g.texts.push({ x:d.x,y:d.y,text:'WEBBED!', col:'#a78bfa', life:800 }); }
      else { setLives(prev=>{ const next=Math.max(0,prev-1); if(next<=0 && gameMode==='survival') setTimeout(()=>setRunning(false),0); return next; });
             setCollected(c=>{ const nc=Math.max(0,c-1); if(c>0) g.texts.push({ x:p.x, y:p.y-12, text:'-1', col:'#fca5a5', life:800 }); return nc; }); }
    }

    if (gameMode==='timed' && (timeLeft - dt <= 0)){ setRunning(false); setPaused(false); setBest(b=>Math.max(b,collected)); }

    drawWorld(canvasRef.current, dims, g, p, { view3D }); // <<< pass toggle
  }, running && !paused);

  const btn = (label, onClick, variant='primary') =>
    <button onClick={onClick} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid', borderColor: variant==='primary'? '#2563eb':'#64748b', background: variant==='primary'? '#3b82f6':'transparent', color:'#fff', cursor:'pointer' }}>{label}</button>;

  const timeStr = (left) => { const s=Math.max(0,Math.ceil(left/1000)); const m=Math.floor(s/60); const ss=(s%60).toString().padStart(2,'0'); return `${m}:${ss}`; };

  return (
    <>
      <RRPageBackground />
      <div style={{ position:'relative', zIndex:1, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'transparent', color:'#e2e8f0' }}>
        <div style={{ width:'100%', maxWidth:1100 }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:8, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <img src="/reaction-rush/rr-icon.png" alt="Reaction Rush" width={56} height={56}
                   style={{ display:'block', borderRadius:12, filter:'drop-shadow(0 0 14px rgba(59,130,246,0.85)) drop-shadow(0 0 26px rgba(59,130,246,0.35))' }}/>
              <div>
                <div style={{ fontSize:24, fontWeight:800, letterSpacing:0.3 }}>Reaction Rush</div>
                <div style={{ fontSize:13, opacity:0.8 }}>Challenge: collect balls, dodge defenders, power-ups — score in the goals!</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {!running ? btn('Start', resetGame) : (<>{btn(paused?'Resume':'Pause', ()=>setPaused(p=>!p), 'secondary')}{btn('Restart', resetGame, 'secondary')}</>)}
              <span style={{ fontSize:12, opacity:0.8 }}>Difficulty:</span>
              {['easy','normal','hard'].map(k=>(
                <button key={k} onClick={()=>setPreset(k)} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid #94a3b8', background: preset===k? '#1e3a8a':'transparent', color:'#fff', cursor:'pointer' }}>{k[0].toUpperCase()+k.slice(1)}</button>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:8 }}>
                <span style={{ fontSize:12, opacity:0.8 }}>Speed</span>
                <input type="range" min="0.25" max="0.70" step="0.01" value={moveScale} onChange={(e)=>setMoveScale(parseFloat(e.target.value))} style={{ accentColor:'#3b82f6' }} />
                <span style={{ fontSize:12, opacity:0.8 }}>{Math.round(moveScale*100)}%</span>
              </div>
              {/* NEW: 3D Camera toggle */}
              <label style={{ display:'flex', alignItems:'center', gap:8, marginLeft:12, fontSize:13 }}>
                <input type="checkbox" checked={view3D} onChange={(e)=>setView3D(e.target.checked)} />
                3D Camera
              </label>
            </div>
          </div>

          {/* Mode select */}
          {!running && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:12, opacity:0.8 }}>Mode:</span>
              {['timed','survival'].map(m=>(
                <button key={m} onClick={()=>setGameMode(m)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #94a3b8', background: gameMode===m?'#0b3b1a':'transparent', color:'#fff', cursor:'pointer' }}>
                  {m==='timed'?'⏳ Timed (60s)':`❤️ Survival (${lives} lives)`}
                </button>
              ))}
            </div>
          )}

          {/* Canvas + HUD */}
          <div onContextMenu={(e)=>e.preventDefault()} style={{
              position:'relative', borderRadius:16, overflow:'hidden',
              border:'1px solid #1f2937', boxShadow:'0 30px 60px rgba(0,0,0,0.45)',
              width: Math.round(dims.W * scale), height: Math.round(dims.H * scale),
              maxWidth:'100vw', maxHeight:'100svh', WebkitTouchCallout:'none',
              WebkitUserSelect:'none', userSelect:'none', WebkitTapHighlightColor:'transparent', touchAction:'none'
            }}>
            <canvas ref={canvasRef} width={dims.W} height={dims.H} draggable={false}
              style={{ transform:`scale(${scale})`, transformOrigin:'top left', display:'block', WebkitUserSelect:'none', userSelect:'none', WebkitTapHighlightColor:'transparent' }}/>
            <RRCanvasFrame />
            <div style={{ pointerEvents:'none', position:'absolute', inset:0, background:'radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)' }} />

            {/* HUD */}
            <div style={{ position:'absolute', top:8, left:8, right:8, display:'flex', alignItems:'center', gap:12, zIndex:30, userSelect:'none', WebkitUserSelect:'none' }}>
              <div style={{ flex:1 }}>
                {gameMode==='timed' && (<>
                  <div style={{ height:10, background:'rgba(255,255,255,0.08)', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)', backdropFilter:'blur(4px)' }}>
                    <div style={{ width:`${(timeLeft/ROUND_TIME)*100}%`, height:'100%', background:'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius:10 }} />
                  </div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:4 }}>Time Left: {timeStr(timeLeft)}</div>
                </>)}
                {gameMode==='survival' && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
                    <span>Lives:</span><span style={{ letterSpacing:2 }}>{'❤️'.repeat(lives) || '—'}</span>
                  </div>
                )}
              </div>
              {stateRef.current.comboCount > 1 && (
                <div style={{ padding:'4px 10px', borderRadius:999, background:'rgba(59,130,246,0.18)', border:'1px solid rgba(59,130,246,0.45)', color:'#e2e8f0', fontSize:12 }}>
                  Combo x{stateRef.current.comboCount} — {Math.ceil(stateRef.current.comboT/1000)}s
                </div>
              )}
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:18, fontWeight:700, padding:'6px 10px', borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', backdropFilter:'blur(4px)' }}>Balls: {collected}</div>
                <div style={{ fontSize:12, opacity:0.8, marginTop:4 }}>Best: {best}</div>
              </div>
            </div>

            {mobile.UI}

            {!running && (
              <div style={{ position:'absolute', inset:0, background:'rgba(2,6,23,0.75)', backdropFilter:'blur(2px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, zIndex:55, userSelect:'none' }}>
                <div style={{ fontSize:28, fontWeight:800 }}>{gameMode==='survival'?'Game Over':'Time!'}</div>
                <div style={{ opacity:0.85 }}>Score: {collected}</div>
                <button onClick={resetGame} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #22c55e', background:'#22c55e', color:'#062c12', fontWeight:800 }}>Play Again</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
