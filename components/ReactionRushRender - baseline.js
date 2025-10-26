/* eslint-disable no-undef */

// ---------- sprite loader ----------
let SPR = null;
function loadImage(url){ const img=new Image(); img.decoding='async'; img.src=url; return img; }
function ensureSprites(){
  if (SPR) return SPR;
  SPR = {
    powerBall: loadImage('/assets/Powerplay_Premiere.png'),
    logoOverlay: loadImage('/assets/power_logo_overlay.png'),
    rrIcon: loadImage('/reaction-rush/rr-icon.png'),
  };
  return SPR;
}
export function warmSprites(){ ensureSprites(); }

// ---------- helpers ----------
function withShake(ctx, g){ const s=Math.max(0,g.shake||0)*0.6; if(!s) return ()=>{}; const dx=(Math.random()-0.5)*s, dy=(Math.random()-0.5)*s; ctx.save(); ctx.translate(dx,dy); return ()=>ctx.restore(); }
function drawCircle(ctx,x,y,r,fill,stroke){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if(fill){ctx.fillStyle=fill; ctx.fill();} if(stroke){ctx.strokeStyle=stroke; ctx.stroke();} }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

// ---------- RR logo backdrop (behind pitch) ----------
function drawBackgroundLogo(ctx, W, H, now) {
  const { rrIcon } = ensureSprites();

  // deep vignette
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.85);
  bg.addColorStop(0, '#0b1020'); bg.addColorStop(1, '#060914');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  ctx.save();
  const pulse = 1 + 0.02 * Math.sin((now||0) * 0.002);
  const size = Math.min(W, H) * 0.95 * pulse;
  ctx.translate(W/2, H/2); ctx.globalAlpha = 0.24;

  if (rrIcon && rrIcon.complete && rrIcon.naturalWidth) {
    const iw=size, ih=iw*(rrIcon.naturalHeight/rrIcon.naturalWidth);
    const g=ctx.createRadialGradient(0,0,0,0,0,iw*0.65);
    g.addColorStop(0,'rgba(59,130,246,0.60)'); g.addColorStop(1,'rgba(59,130,246,0.00)');
    ctx.fillStyle=g; drawCircle(ctx,0,0,iw*0.65,ctx.fillStyle);

    ctx.globalCompositeOperation='screen';
    ctx.drawImage(rrIcon,-iw/2,-ih/2,iw,ih);
    ctx.globalCompositeOperation='source-over';
  } else {
    ctx.font=`900 ${Math.floor(size*0.35)}px Inter, system-ui, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#1e3a8a'; ctx.fillText('RR',0,0);
  }

  // soft electric ring
  for (let i=0;i<4;i++){
    const r=size*(0.40+0.1*i)*(1+0.01*Math.sin(now*0.004+i));
    ctx.globalAlpha=0.08 + 0.03*Math.sin(now*0.003+i*2.1); ctx.lineWidth=2; ctx.strokeStyle='#60a5fa';
    ctx.beginPath();
    for (let t=0;t<=64;t++){ const a=(t/64)*Math.PI*2; const wob=1+0.02*Math.sin(a*9+now*0.01+i*2.3); const x=Math.cos(a)*r*wob, y=Math.sin(a)*r*wob; t?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath(); ctx.stroke();
  }

  ctx.restore(); ctx.globalAlpha=1;
}

// ---------- 3D PITCH ----------
function drawPitch(ctx, W, H) {
  const inset = 22; // gameplay boundary remains the same

  // 1) Grass base with stripes (slightly transparent so the RR logo glows through)
  const stripeH = 28;
  for (let y=0; y<H; y+=stripeH) {
    ctx.fillStyle = (Math.floor(y/stripeH)%2===0) ? 'rgba(11,106,58,0.86)' : 'rgba(10,94,52,0.84)';
    ctx.fillRect(0,y,W,stripeH);
  }

  // 2) Stadium lighting gradient (top brighter, bottom darker)
  const light = ctx.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0.0, 'rgba(255,255,255,0.08)');
  light.addColorStop(0.4, 'rgba(255,255,255,0.00)');
  light.addColorStop(1.0, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = light; ctx.fillRect(0,0,W,H);

  // 3) Inner wall shadows to fake depth (sunken pitch look)
  ctx.save();
  // top bevel
  let g = ctx.createLinearGradient(0, inset, 0, inset+26);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(inset, inset, W-inset*2, 26);
  // bottom bevel
  g = ctx.createLinearGradient(0, H-inset-26, 0, H-inset);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(inset, H-inset-26, W-inset*2, 26);
  // left bevel
  g = ctx.createLinearGradient(inset, 0, inset+26, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(inset, inset, 26, H-inset*2);
  // right bevel
  g = ctx.createLinearGradient(W-inset-26, 0, W-inset, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g; ctx.fillRect(W-inset-26, inset, 26, H-inset*2);
  ctx.restore();

  // 4) Thin inner highlight ring (adds a beveled rim)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(inset+1, inset+1, W - (inset+1)*2, H - (inset+1)*2);
  ctx.restore();

  // 5) Pitch lines (slightly brighter than before)
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 2;

  ctx.strokeRect(inset, inset, W - inset*2, H - inset*2);
  ctx.beginPath(); ctx.moveTo(W/2, inset); ctx.lineTo(W/2, H - inset); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2, H/2, 80, 0, Math.PI*2); ctx.stroke();
  ctx.strokeRect(0, (H/2)-70, inset, 140);
  ctx.strokeRect(W-inset, (H/2)-70, inset, 140);
  ctx.restore();

  // 6) Faint wordmark overlay near top
  const { logoOverlay } = ensureSprites();
  ctx.save();
  ctx.globalAlpha = 0.18;
  if (logoOverlay && logoOverlay.complete && logoOverlay.naturalWidth) {
    const iw = Math.min(W * 0.50, logoOverlay.naturalWidth);
    const ih = iw * (logoOverlay.naturalHeight / logoOverlay.naturalWidth);
    ctx.drawImage(logoOverlay, (W - iw)/2, H * 0.06, iw, ih);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 80px Inter, system-ui, sans-serif';
    ctx.fillText('POWERPLAY', W/2, H * 0.16);
  }
  ctx.restore();

  // 7) Outer drop shadow (makes the whole pitch feel raised)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const outer = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.max(W,H)*0.65);
  outer.addColorStop(0, 'rgba(0,0,0,0)');
  outer.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = outer;
  ctx.fillRect(0,0,W,H);
  ctx.restore();
}

// ---------- entities & effects ----------
function drawDefender(ctx, d) {
  const r = d.r;
  const base = d.frozenT > 0 ? '#86b8ff' : '#c026d3';
  const edge = d.frozenT > 0 ? '#4a7bd8' : '#701a75';
  drawCircle(ctx, d.x, d.y, r, base, edge);
  ctx.beginPath(); ctx.arc(d.x - r*0.3, d.y - r*0.35, r*0.45, Math.PI*1.2, Math.PI*2.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
}
function drawIceBall(ctx, x, y, r, t) {
  const grad = ctx.createRadialGradient(x-r*0.4, y-r*0.4, r*0.2, x, y, r);
  grad.addColorStop(0, '#e8f3ff'); grad.addColorStop(1, '#8ec5ff');
  drawCircle(ctx, x, y, r, grad, '#6aa8ff');
  ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
  for (let i=0;i<5;i++){ const a=(i/5)*Math.PI*2+(t*0.001); ctx.beginPath();
    ctx.moveTo(x+Math.cos(a)*r*0.2, y+Math.sin(a)*r*0.2);
    ctx.lineTo(x+Math.cos(a)*r*0.9, y+Math.sin(a)*r*0.9); ctx.stroke();
  } ctx.restore();
}
function drawBomb(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t*0.003 + x*0.01)*0.05);
  ctx.beginPath(); const pts=7;
  for (let i=0;i<pts;i++){ const ang=(i/pts)*Math.PI*2; const rr=r*(0.9+0.06*Math.sin(i*12.3));
    const px=Math.cos(ang)*rr, py=Math.sin(ang)*rr; i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  } ctx.closePath(); ctx.fillStyle='#8b1d24'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#3b0b0f'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r*0.1, -r*0.4); ctx.quadraticCurveTo(r*0.7,-r*0.9, r*1.0, -r*1.3);
  ctx.strokeStyle='#472a00'; ctx.lineWidth=2; ctx.stroke();
  const pulse=0.4+0.6*(0.5+0.5*Math.sin(t*0.02)); ctx.globalAlpha=0.8; ctx.fillStyle='#ffcf33';
  drawCircle(ctx, r*1.0, -r*1.3, r*0.25*(0.8+pulse*0.2)); ctx.globalAlpha=1; ctx.restore();
}
function drawMedkit(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = 0.25; drawCircle(ctx, 3, r*0.9, r*0.55, 'rgba(0,0,0,0.35)'); ctx.globalAlpha = 1;
  const w = r*1.6, h = r*1.2, rad = r*0.25;
  ctx.fillStyle = '#f3f4f6'; ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w/2+rad, -h/2); ctx.lineTo(w/2-rad, -h/2); ctx.quadraticCurveTo(w/2, -h/2, w/2, -h/2+rad);
  ctx.lineTo(w/2, h/2-rad); ctx.quadraticCurveTo(w/2, h/2, w/2-rad, h/2);
  ctx.lineTo(-w/2+rad, h/2); ctx.quadraticCurveTo(-w/2, h/2, -w/2, h/2-rad);
  ctx.lineTo(-w/2, -h/2+rad); ctx.quadraticCurveTo(-w/2, -h/2, -w/2+rad, -h/2);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.lineWidth = 3; ctx.strokeStyle = '#6b7280';
  ctx.moveTo(-r*0.6, -h/2); ctx.quadraticCurveTo(0, -r*1.0, r*0.6, -h/2); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-r*0.20, -r*0.45, r*0.40, r*0.30);
  ctx.fillRect(-r*0.45, -r*0.20, r*0.30, r*0.40);
  ctx.restore();
}
function drawTrail(ctx, g) { for (const t of g.trail) { ctx.globalAlpha = Math.max(0, t.a); drawCircle(ctx, t.x, t.y, t.r, 'rgba(34,211,238,0.2)'); } ctx.globalAlpha = 1; }
function drawParticles(ctx, g) {
  for (const p of g.particles) {
    if (p.type === 'ring') {
      const k = p.life / p.max; ctx.lineWidth = p.thick * k; ctx.strokeStyle = p.color || '#fff';
      ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(p.x, p.y, (1-k)*10 + (1-k)*60, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (p.type === 'web') {
      const k = p.life / p.max; ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#f472b6';
      for (let i=0;i<(p.lines||8);i++){ const a=(i/(p.lines||8))*Math.PI*2; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+Math.cos(a)*60*(1-k), p.y+Math.sin(a)*60*(1-k)); ctx.stroke(); }
      ctx.restore();
    } else if (p.type === 'confetti') {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life/p.max); ctx.fillStyle = p.col || '#fff';
      ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2); ctx.restore();
    } else if (p.type === 'spark' || p.type === 'gib' || p.type === 'coin') {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life/p.max); ctx.fillStyle = p.col || (p.type==='gib' ? '#e11d48' : '#ffd60a');
      drawCircle(ctx, p.x, p.y, p.r || 3, ctx.fillStyle); ctx.restore();
    }
  }
}
function drawTexts(ctx, texts) { for (const t of texts) { const k = Math.max(0, t.life / 1200); ctx.globalAlpha = k; ctx.fillStyle = t.col || '#fff'; ctx.font = '700 14px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.text, t.x, t.y); } ctx.globalAlpha = 1; }

// player (Spidey during powerplay)
function drawPlayer(ctx, p, g) {
  if (g.powerplayT > 0) {
    const r = p.r + 2;
    drawCircle(ctx, p.x, p.y, r, '#d92323', '#800f0f');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.4;
    for (let i=1;i<=3;i++){ ctx.beginPath(); ctx.arc(p.x, p.y, (r*i)/3, 0, Math.PI*2); ctx.stroke(); }
    for (let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+Math.cos(a)*r, p.y+Math.sin(a)*r); ctx.stroke(); }
  } else {
    drawCircle(ctx, p.x, p.y, p.r, '#22d3ee', '#155e75');
  }
}

// balls
function drawPowerplayBall(ctx, x, y, r, { gold = false } = {}) {
  const { powerBall } = ensureSprites();
  const has = powerBall && powerBall.complete && powerBall.naturalWidth;
  if (has) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(powerBall, x - r, y - r, r * 2, r * 2);
    if (gold) {
      ctx.globalCompositeOperation = 'multiply';
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, '#ffd54a'); g.addColorStop(1, '#ffb300');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  } else {
    const base = gold ? '#ffcf40' : '#e6f0ff';
    const ring = gold ? '#c99700' : '#1f4fbf';
    drawCircle(ctx, x, y, r, base, ring);
    drawCircle(ctx, x - 3, y - 3, r * 0.7, gold ? 'rgba(201,151,0,0.25)' : 'rgba(31,79,191,0.20)');
  }
}
function drawBalls(ctx, balls, now) {
  for (const b of balls) {
    if (b.type === 'gold') {
      drawPowerplayBall(ctx, b.x, b.y, b.r, { gold: false });
    } else if (b.type === 'ice') {
      drawIceBall(ctx, b.x, b.y, b.r, now);
    } else if (b.type === 'dynamite') {
      drawBomb(ctx, b.x, b.y, b.r, now);
    } else if (b.type === 'dribble') {
      drawPowerplayBall(ctx, b.x, b.y, b.r + 1, { gold: true });
    } else if (b.type === 'medkit') {
      drawMedkit(ctx, b.x, b.y, b.r);
    } else if (b.type === 'powerplay') {
      drawCircle(ctx, b.x, b.y, b.r, '#f472b6', '#a21caf');
      ctx.save(); ctx.strokeStyle = '#fce7f3'; ctx.lineWidth = 1;
      for (let i=0;i<6;i++){ const a=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(a)*b.r*0.8, b.y+Math.sin(a)*b.r*0.8); ctx.stroke(); }
      ctx.restore();
    } else {
      drawCircle(ctx, b.x, b.y, b.r, '#facc15', '#a16207');
    }
  }
}

// zones
function drawZones(ctx, zones, now) {
  for (const z of zones) {
    const k = 0.5 + 0.5*Math.sin((z.pulse || 0) * 0.01);
    let base = '#22d3ee', ring = '#0891b2';
    if (z.type === 'invincible'){ base = '#eab308'; ring='#a16207'; }
    if (z.type === 'shot'){ base = '#a78bfa'; ring='#6d28d9'; }
    const a = clamp(z.life / 10000, 0.25, 1);

    // outer ring pulse
    ctx.save();
    ctx.globalAlpha = 0.45 * a;
    ctx.lineWidth = 4 + 3*k;
    ctx.strokeStyle = base;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 + 0.06*k), 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // filled core
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.12*k;
    const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r*1.2);
    g.addColorStop(0, base); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; drawCircle(ctx, z.x, z.y, z.r, ctx.fillStyle, ring);
    ctx.restore();
  }
}

// goal banner
function drawGoalBanner(ctx, g, W, H) {
  if (!g.goalT) return;
  const k = 1 - (g.goalT / 1200);
  const scale = 0.9 + 0.2 * Math.sin(k * Math.PI);
  ctx.save(); ctx.translate(W/2, H*0.35); ctx.scale(scale, scale);
  ctx.globalAlpha = 0.35 * (1 - k); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 12 * (1 - k);
  ctx.beginPath(); ctx.arc(0, 0, 140 + 80*k, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.font = '900 64px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#22c55e'; ctx.strokeStyle = '#064e3b'; ctx.lineWidth = 6;
  ctx.strokeText('GOAL!', 0, 0); ctx.fillText('GOAL!', 0, 0);
  ctx.restore();
}

// corner logo (foreground) — bottom-right
function drawCornerLogo(ctx, W, H, now) {
  const { rrIcon } = ensureSprites();
  const pad = 10;
  const size = 36;
  const x = W - pad - size / 2;
  const y = H - pad - size / 2;

  ctx.save();

  // halo
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 36);
  halo.addColorStop(0, 'rgba(59,130,246,0.55)');
  halo.addColorStop(1, 'rgba(59,130,246,0)');
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI*2); ctx.fill();

  // subtle orbiting arcs
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#60a5fa';
  const arcR = 30;
  const t = now * 0.004;
  ctx.beginPath();
  for (let i=0;i<2;i++){
    const a0 = t + i*Math.PI;
    const a1 = a0 + Math.PI*0.5;
    ctx.arc(x, y, arcR, a0, a1);
  }
  ctx.stroke();

  // icon
  ctx.globalAlpha = 0.95;
  if (rrIcon && rrIcon.complete && rrIcon.naturalWidth) {
    ctx.drawImage(rrIcon, x - size/2, y - size/2, size, size);
  } else {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(x, y, size/2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.font = '900 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RR', x, y);
  }
  ctx.restore();
}

// ---------- main ----------
export function drawWorld(canvas, dims, g, p) {
  if (!canvas) return;
  const now = performance.now?.() || Date.now();
  const ctx = canvas.getContext('2d');
  const { W, H } = dims;

  // clear & background logo
  ctx.clearRect(0, 0, W, H);
  drawBackgroundLogo(ctx, W, H, now);

  // pitch over it
  drawPitch(ctx, W, H);

  const unshake = withShake(ctx, g);

  // border pulse
  if (g.borderPulse) {
    const k = g.borderPulse.t / g.borderPulse.dur;
    ctx.save(); ctx.strokeStyle = g.borderPulse.color || '#fff'; ctx.globalAlpha = k * 0.8; ctx.lineWidth = 8 * k;
    ctx.strokeRect(4, 4, W-8, H-8); ctx.restore();
  }

  // carried/shot ball first (under actors)
  if (g.carryBall && (g.carryBall.state === 'carried' || g.carryBall.state === 'shot')) {
    drawPowerplayBall(ctx, g.carryBall.x, g.carryBall.y, g.carryBall.r + 1, { gold: true });
  }

  drawBalls(ctx, g.balls, now);
  // soft ground shadow under player for 3D cue
  if (p) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, p.r * 1.4, p.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawTrail(ctx, g);
  drawPlayer(ctx, p, g);

  for (const d of g.defenders) {
    // little drop shadow for depth
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + 7, d.r * 1.3, d.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawDefender(ctx, d);
  }

  drawZones(ctx, g.zones || [], now);
  drawParticles(ctx, g);
  drawTexts(ctx, g.texts);
  drawGoalBanner(ctx, g, W, H);
  drawCornerLogo(ctx, W, H, now);

  unshake();
}
