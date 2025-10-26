'use client';
import React, { useEffect, useRef, useState } from 'react';

export default function PowerPlaySoccer() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });

    // ---------- WORLD ----------
    const W = 1280, H = 720;
    const field = { left: 90, right: W - 90, top: 70, bottom: H - 70, midX: W/2, midY: H/2 };
    const goalH = 200, goalW = 26;
    const goalLeft  = { x: field.left - goalW,  y: field.midY - goalH/2, w: goalW, h: goalH };
    const goalRight = { x: field.right,         y: field.midY - goalH/2, w: goalW, h: goalH };
    const penW = 150, penH = 300; // for keeper logic

    // ---------- TUNING ----------
    const PLAYER_R = 13, GOALIE_R = 16, BALL_R = 7;
    const PLAYER_MAX = 290;        // slower for better control
    const PLAYER_RESP = 12.5;
    const AI_DRAG = 1.1, BALL_DRAG = 1.06, RESTITUTION = 0.9;
    const DRIBBLE_DIST = 16, PASS_SPEED = 800, SHOT_SPEED = 1000, AFTERTOUCH = 230;
    const STUN_TIME = 0.55;
    const PASS_CD = 0.10, SHOT_CD = 0.22, SWITCH_CD = 0.15, TACKLE_CD = 0.55;

    const SEP_DIST = 56, SEP_PUSH = 950, COLLISION_ITERS = 2, SEP_MIN_VEL = 30;

    // AI intent
    const SHOOT_RANGE_X = 260, SHOOT_GOAL_TOL = 18, DANGER_RADIUS = 90;
    const WALL_AVOID_DIST = 50, CORNER_REPEL = 1300, HOME_TETHER = 0.7, BALL_BIAS = 0.28;
    const PASS_MIN_DIST = 70, PASS_MAX_DIST = 560, PASS_OPEN_ANGLE = Math.PI * 0.85;

    // ---------- FEEL / FX ----------
    const SHAKE_DECAY = 8, DASH_CD = 1.0, DASH_IMP = 520, TRAIL_LEN = 18;
    let shakeMag = 0, shakeX = 0, shakeY = 0;
    const particles = [], ballTrail = [];

    // ---------- INPUT ----------
    const keys = new Set(), justPressed = new Set();
    const cd = { tackle:0, pass:0, shoot:0, switch:0, dash:0 };
    const onDown = e => {
      const k = e.key.toLowerCase();
      if (!keys.has(k)) justPressed.add(k);
      keys.add(k);
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
      if (k === 'p') setPaused(v => !v);
    };
    const onUp = e => keys.delete(e.key.toLowerCase());
    const ensureFocus = () => { try { wrapRef.current?.focus(); } catch {} };

    // ---------- UTILS ----------
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    const norm = (x,y)=>{ const m=Math.hypot(x,y)||1; return {x:x/m,y:y/m}; };
    const rnd = (a,b)=>Math.random()*(b-a)+a;
    const dist2 = (a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
    const expDrag = (v,d,dt)=> v*Math.exp(-d*dt);
    const rectContains = (pt, r)=> (pt.x>r.x && pt.x<r.x+r.w && pt.y>r.y && pt.y<r.y+r.h);
    function triggerShake(m=6){ shakeMag=Math.max(shakeMag,m); }
    function emitSparks(x,y,c=12){ for(let i=0;i<c;i++){ const a=Math.random()*Math.PI*2,s=90+Math.random()*200; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4,size:2}); } }
    function pushTrail(){ ballTrail.push({x:ball.x,y:ball.y}); if(ballTrail.length>TRAIL_LEN) ballTrail.shift(); }
    function updateFX(dt){
      for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.exp(-3*dt); p.vy*=Math.exp(-3*dt); p.life-=dt; if(p.life<=0) particles.splice(i,1); }
      if(shakeMag>0){ shakeMag=Math.max(0,shakeMag-SHAKE_DECAY*dt); shakeX=(Math.random()*2-1)*shakeMag; shakeY=(Math.random()*2-1)*shakeMag; } else { shakeX=shakeY=0; }
    }

    // ---------- TEAMS ----------
    function spawnTeam(side){
      const cx = field.midX + (side==='A' ? -280 : +280);
      const s  = side==='A' ? +1 : -1;
      const layout=[
        {hx:cx+  0*s, hy:field.midY,       role:'ST'},
        {hx:cx+ 90*s, hy:field.midY-130,   role:'WG'},
        {hx:cx+ 90*s, hy:field.midY+130,   role:'WG'},
        {hx:cx+190*s, hy:field.midY- 40,   role:'CM'},
        {hx:cx+190*s, hy:field.midY+ 40,   role:'CM'},
      ];
      return layout.map(p=>({x:p.hx,y:p.hy,hx:p.hx,hy:p.hy,runTx:p.hx,runTy:p.hy,vx:0,vy:0,dirx:s,side,role:p.role,stun:0,animT:0,animF:0}));
    }
    const teamA = spawnTeam('A');
    const teamB = spawnTeam('B');
    const goalieA = { x: field.left + 12,  y: field.midY, vx:0, vy:0, side:'A' };
    const goalieB = { x: field.right - 12, y: field.midY, vx:0, vy:0, side:'B' };

    const ball = { x: field.midX, y: field.midY, vx:0, vy:0, owner:null, lastTouch:'A', after:0 };
    let controlled = { team:'A', idx:0 };

    const score = { goalsA:0, goalsB:0, pointsA:0, pointsB:0, multA:1, multB:1, time:0 };

    // ---------- ASSETS ----------
    function basePath(){ if(typeof window!=='undefined' && window.__NEXT_DATA__) return (window.__NEXT_DATA__.assetPrefix||window.__NEXT_DATA__.basePath||'').replace(/\/$/,''); return ''; }
    const ROOTS=['/powerplay-assets','/reaction-rush'];
    const NAMES={
      backdrop:['v3_arena_backdrop.png'],
      ball:['v3_ball_powerplay.png','ball.png'],
      playerBlue:['v3_player_blue.png','player_blue.png'],
      playerMag:['v3_player_magenta.png','player_magenta.png'],
    };
    const imgs={};
    function loadKey(k,r=0,n=0){
      if(r>=ROOTS.length) return Promise.reject(new Error(`Missing ${k}`));
      if(n>=NAMES[k].length) return loadKey(k,r+1,0);
      const src=`${basePath()}${ROOTS[r]}/${NAMES[k][n]}`;
      return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>{imgs[k]=im; res();}; im.onerror=()=>loadKey(k,r,n+1).then(res).catch(rej); im.src=src; });
    }
    const loadImages=()=>Promise.all(Object.keys(NAMES).map(k=>loadKey(k)));

    // ---------- RESIZE ----------
    function sizeCanvas(){
      const parent = wrapRef.current;
      const w = parent.clientWidth, h = parent.clientHeight;
      const target = W/H;
      let cw=w, ch=Math.floor(w/target);
      if(ch>h){ ch=h; cw=Math.floor(h*target); }
      const dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=cw*dpr; canvas.height=ch*dpr; canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
      ctx.setTransform(cw/W*dpr,0,0,ch/H*dpr,0,0);
      ctx.imageSmoothingEnabled=true;
    }

    // ---------- HELPERS ----------
    const matesOf = t => t==='A'? teamA : teamB;
    const foesOf  = t => t==='A'? teamB : teamA;
    const theirGoal = t => t==='A'? goalRight : goalLeft;
    const ourGoal   = t => t==='A'? goalLeft  : goalRight;
    const keeperOf  = t => t==='A'? goalieA   : goalieB;
    const nearestTo = (o,arr)=>{ let i=-1,d=Infinity; for(let k=0;k<arr.length;k++){ const dk=dist2(o,arr[k]); if(dk<d){d=dk;i=k;} } return i; };
    const presserIndex = t => nearestTo(ball, matesOf(t));

    function resetKickoff(lastScorer='A'){
      ball.x=field.midX; ball.y=field.midY; ball.vx=ball.vy=0; ball.owner=null; ball.after=0;
      [[teamA,'A'],[teamB,'B']].forEach(([t])=>t.forEach(p=>{ p.vx=p.vy=0; p.stun=0; p.x=p.hx+rnd(-8,8); p.y=p.hy+rnd(-8,8); p.runTx=p.hx; p.runTy=p.hy; p.animT=0; p.animF=0; }));
      goalieA.y=field.midY; goalieB.y=field.midY;
      controlled = { team: lastScorer==='A' ? 'B' : 'A', idx:0 };
    }

    // ---------- CONTROLLED ----------
    function controlStep(dt){
      const team = matesOf(controlled.team);
      const mates = team;                // <-- FIX for "mates is not defined"
      const p = team[controlled.idx];

      let ax=0, ay=0;
      if(keys.has('w')||keys.has('arrowup')) ay-=1;
      if(keys.has('s')||keys.has('arrowdown')) ay+=1;
      if(keys.has('a')||keys.has('arrowleft')) ax-=1;
      if(keys.has('d')||keys.has('arrowright')) ax+=1;
      const moving = Math.abs(ax)+Math.abs(ay)>0;
      const dir = norm(ax,ay);

      if(p.stun>0) p.stun-=dt;
      const targetVx = moving? dir.x*PLAYER_MAX : 0;
      const targetVy = moving? dir.y*PLAYER_MAX : 0;
      p.vx += (targetVx - p.vx)*PLAYER_RESP*dt;
      p.vy += (targetVy - p.vy)*PLAYER_RESP*dt;
      if(moving) p.dirx = Math.sign(dir.x || p.dirx || (controlled.team==='A'?1:-1));

      cd.tackle=Math.max(0,cd.tackle-dt);
      cd.pass  =Math.max(0,cd.pass  -dt);
      cd.shoot =Math.max(0,cd.shoot -dt);
      cd.switch=Math.max(0,cd.switch-dt);
      cd.dash  =Math.max(0,cd.dash  -dt);

      // Dash
      if((justPressed.has(' ')||justPressed.has('enter')) && cd.dash===0){
        const dirv = (Math.abs(p.vx)+Math.abs(p.vy)>4)? norm(p.vx,p.vy) : norm(dir.x||p.dirx||1,dir.y||0);
        p.vx += dirv.x*DASH_IMP; p.vy += dirv.y*DASH_IMP; cd.dash=DASH_CD; emitSparks(p.x,p.y,18); triggerShake(6);
      }

      // First-touch pass (as the ball arrives)
      const ftPass = (justPressed.has('j') && cd.pass===0 && !ball.owner && Math.hypot(ball.x-p.x,ball.y-p.y) < PLAYER_R+18);
      if(ftPass){
        cd.pass = PASS_CD;
        const idx = bestPassTarget(controlled.team, p);
        if(idx!==-1){ const t=mates[idx]; const v=norm(t.x-ball.x, t.y-ball.y); ball.owner=null; ball.vx=v.x*PASS_SPEED; ball.vy=v.y*PASS_SPEED; ball.lastTouch=controlled.team; ball.after=0.12; }
      }

      // Tackle
      if((justPressed.has('h')||justPressed.has('shift')) && cd.tackle===0){
        cd.tackle=TACKLE_CD;
        const ahead={x:p.x+(p.dirx||1)*26,y:p.y};
        const foes=foesOf(controlled.team);
        const hitIdx=nearestTo(ahead,foes);
        if(hitIdx>=0 && Math.hypot(foes[hitIdx].x-ahead.x,foes[hitIdx].y-ahead.y)<26){
          const foe=foes[hitIdx]; const n=norm(foe.x-p.x,foe.y-p.y);
          foe.stun=STUN_TIME; foe.vx+=n.x*520; foe.vy+=n.y*520; emitSparks(foe.x,foe.y,14); triggerShake(8);
          if(ball.owner && ball.owner.team!==controlled.team && ball.owner.idx===hitIdx){
            ball.owner=null; ball.vx=n.x*420; ball.vy=n.y*160; ball.lastTouch=controlled.team;
          }
        }
      }

      // Pass (while running)
      if((justPressed.has('j')||keys.has('j')) && cd.pass===0 && ball.owner && ball.owner.team===controlled.team && ball.owner.idx===controlled.idx){
        cd.pass=PASS_CD;
        const i=bestPassTarget(controlled.team);
        if(i!==-1){ const t=mates[i]; const v=norm(t.x-ball.x,t.y-ball.y); ball.owner=null; ball.vx=v.x*PASS_SPEED; ball.vy=v.y*PASS_SPEED; ball.lastTouch=controlled.team; ball.after=0.12; }
      }

      // Shoot
      if((justPressed.has('k')||keys.has('k')) && cd.shoot===0 && ball.owner && ball.owner.team===controlled.team && ball.owner.idx===controlled.idx){
        cd.shoot=SHOT_CD;
        const g=theirGoal(controlled.team);
        const gx=g.x+g.w/2+(controlled.team==='A'?+6:-6);
        const gy=clamp(ball.y, g.y+SHOOT_GOAL_TOL, g.y+g.h-SHOOT_GOAL_TOL);
        const v=norm(gx-ball.x, gy-ball.y);
        ball.owner=null; ball.vx=v.x*SHOT_SPEED; ball.vy=v.y*SHOT_SPEED; ball.lastTouch=controlled.team; ball.after=0.24;
      }

      // Switch
      if((justPressed.has('l')||keys.has('l')) && cd.switch===0){
        cd.switch=SWITCH_CD;
        const i = nearestTo(ball, mates);
        if(i>=0) controlled.idx=i;
      }
    }

    // ---------- AI ----------
    function wallAvoid(p){
      let ax=0, ay=0;
      if(p.x-field.left < WALL_AVOID_DIST) ax += (1 - (p.x-field.left)/WALL_AVOID_DIST);
      if(field.right-p.x < WALL_AVOID_DIST) ax -= (1 - (field.right-p.x)/WALL_AVOID_DIST);
      if(p.y-field.top < WALL_AVOID_DIST) ay += (1 - (p.y-field.top)/WALL_AVOID_DIST);
      if(field.bottom-p.y < WALL_AVOID_DIST) ay -= (1 - (field.bottom-p.y)/WALL_AVOID_DIST);
      // corners
      const corners=[{x:field.left,y:field.top},{x:field.left,y:field.bottom},{x:field.right,y:field.top},{x:field.right,y:field.bottom}];
      for(const c of corners){ const dx=p.x-c.x, dy=p.y-c.y, d=Math.hypot(dx,dy); if(d<WALL_AVOID_DIST){ const n={x:dx/(d||1),y:dy/(d||1)}; ax+=n.x*(1-d/WALL_AVOID_DIST)*(CORNER_REPEL/1200); ay+=n.y*(1-d/WALL_AVOID_DIST)*(CORNER_REPEL/1200); } }
      return {x:ax,y:ay};
    }

    function bestPassTarget(tag, fromPlayer=null){
      const me = matesOf(tag);
      const foe = foesOf(tag);
      // --- FIX: use keeper position if goalie owns the ball
      let origin;
      if (fromPlayer) origin = fromPlayer;
      else if (ball.owner && ball.owner.team===tag) {
        origin = (ball.owner.idx===-1) ? keeperOf(tag) : me[ball.owner.idx];
      } else origin = { x: ball.x, y: ball.y };

      let best=-1, bestScore=-Infinity;
      for(let i=0;i<me.length;i++){
        if(ball.owner && tag===ball.owner.team && i===ball.owner.idx) continue;
        const t=me[i];
        const dx=t.x-origin.x, dy=t.y-origin.y;
        const d=Math.hypot(dx,dy);
        if(d<PASS_MIN_DIST || d>PASS_MAX_DIST) continue;
        const toGoalX=(tag==='A'?+1:-1);
        const angCos=(dx*toGoalX + Math.abs(dy)*0.25)/(d||1);
        if(Math.acos(clamp(angCos,-1,1))>PASS_OPEN_ANGLE) continue;
        const nf=nearestTo(t, foe);
        const foeDist=nf>=0? Math.hypot(foe[nf].x-t.x, foe[nf].y-t.y):999;
        const score = -d + foeDist*0.9 + (t.role==='ST'?80:0) + Math.random()*10;
        if(score>bestScore){ bestScore=score; best=i; }
      }
      return best;
    }

    function planOffBallRuns(tag){
      const me = matesOf(tag), dir = tag==='A'? +1 : -1;
      const carrier = ball.owner && ball.owner.team===tag && ball.owner.idx>=0 ? me[ball.owner.idx] : null;
      me.forEach(p=>{
        let tx=p.hx, ty=p.hy;
        if (carrier){
          if(p.role==='ST'){ tx=clamp(carrier.x+dir*140,field.left+60,field.right-60); ty=clamp(carrier.y+(p.hy<field.midY?-80:80),field.top+60,field.bottom-60); }
          else if(p.role==='WG'){ const s=p.hy<field.midY?-1:+1; tx=clamp(carrier.x+dir*120,field.left+60,field.right-60); ty=clamp(carrier.y+s*110,field.top+60,field.bottom-60); }
          else { tx=clamp(carrier.x+dir*60,field.left+60,field.right-60); ty=clamp(carrier.y+(p.hy<field.midY?-40:40),field.top+60,field.bottom-60); }
        } else {
          tx=p.hx+(ball.x-field.midX)*BALL_BIAS*0.6; ty=p.hy+(ball.y-field.midY)*BALL_BIAS*0.6;
        }
        p.runTx=tx; p.runTy=ty;
      });
    }

    function applySeparation(team, dt){
      for(let i=0;i<team.length;i++) for(let j=i+1;j<team.length;j++){
        const a=team[i], b=team[j];
        const dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy)||1;
        if(d<SEP_DIST){
          const n={x:dx/d,y:dy/d}, push=(SEP_DIST-d)/SEP_DIST;
          a.vx+=n.x*SEP_PUSH*push*dt; a.vy+=n.y*SEP_PUSH*push*dt;
          b.vx-=n.x*SEP_PUSH*push*dt; b.vy-=n.y*SEP_PUSH*push*dt;
        }
      }
    }

    function aiStep(dt){
      planOffBallRuns('A'); planOffBallRuns('B');

      const tick = tag => {
        const me=matesOf(tag), foe=foesOf(tag);
        const haveBall = (ball.owner && ball.owner.team===tag && ball.owner.idx>=0);
        const ownerIdx = haveBall ? ball.owner.idx : -1;
        const presIdx = presserIndex(tag);

        me.forEach((p,i)=>{
          if(tag===controlled.team && i===controlled.idx) return;
          if(p.stun>0){ p.stun-=dt; return; }

          if(i===ownerIdx){
            const g=theirGoal(tag); const push=wallAvoid(p);
            const toGoal=norm((tag==='A'?+1:-1),(ball.y<g.y?0.1:ball.y>g.y+g.h?-0.1:0));
            p.vx += (toGoal.x + push.x*0.6)*300*dt;
            p.vy += (toGoal.y + push.y*0.6)*300*dt;

            const inShootX = (tag==='A') ? (g.x - ball.x < SHOOT_RANGE_X) : (ball.x - g.x < SHOOT_RANGE_X);
            const nearPost = (Math.random()<0.65) ? (g.y+22) : (g.y+g.h-22);
            const gy = clamp(ball.y, nearPost-36, nearPost+36);
            const v = norm((g.x+g.w/2)-ball.x, gy-ball.y);

            const nf=nearestTo(ball, foe);
            const foeDist = nf>=0 ? Math.hypot(foe[nf].x-p.x, foe[nf].y-p.y) : 999;
            const stuck = (p.x-field.left<22 || field.right-p.x<22 || p.y-field.top<22 || field.bottom-p.y<22);

            if(inShootX && foeDist>50){
              ball.owner=null; ball.vx=v.x*SHOT_SPEED; ball.vy=v.y*SHOT_SPEED; ball.lastTouch=tag; ball.after=0.25;
            } else if (foeDist<DANGER_RADIUS || stuck){
              const idx=bestPassTarget(tag);
              if(idx!==-1){ const t=me[idx]; const pv=norm(t.x-ball.x,t.y-ball.y); ball.owner=null; ball.vx=pv.x*PASS_SPEED; ball.vy=pv.y*PASS_SPEED; ball.lastTouch=tag; ball.after=0.16; }
            }
          } else if (i===presIdx) {
            const push=wallAvoid(p), v=norm(ball.x-p.x,ball.y-p.y);
            p.vx += (v.x + push.x*0.5)*320*dt; p.vy += (v.y + push.y*0.5)*320*dt;
          } else {
            const v=norm(p.runTx-p.x, p.runTy-p.y); const push=wallAvoid(p);
            p.vx += (v.x*280 + push.x*80)*dt; p.vy += (v.y*280 + push.y*80)*dt;
          }

          p.vx = expDrag(p.vx, AI_DRAG, dt);
          p.vy = expDrag(p.vy, AI_DRAG, dt);
        });

        applySeparation(me, dt);
      };
      tick('A'); tick('B');

      // Goalkeepers
      const boxA={x:field.left, y:field.midY-penH/2, w:penW, h:penH};
      const boxB={x:field.right-penW, y:field.midY-penH/2, w:penW, h:penH};

      const keep=(g, box, dir)=>{
        const ty = clamp(ball.y, box.y+24, box.y+box.h-24);
        g.vy = clamp((ty-g.y)*6, -270, 270);
        g.y  = clamp(g.y + g.vy*dt, box.y+24, box.y+box.h-24);

        const close = Math.hypot(ball.x-g.x,ball.y-g.y) < GOALIE_R+18;
        if(!ball.owner && rectContains(ball, {x:box.x-6,y:box.y,w:box.w+12,h:box.h}) && close){
          ball.owner={team:g.side, idx:-1}; // keeper owns
        }

        if(ball.owner && ball.owner.team===g.side && ball.owner.idx===-1){
          const me = matesOf(g.side);
          const idx = bestPassTarget(g.side, g);
          if(idx!==-1){
            const t=me[idx]; const v=norm(t.x-g.x,t.y-g.y);
            ball.owner=null; ball.x=g.x+v.x*18; ball.y=g.y+v.y*18; ball.vx=v.x*PASS_SPEED; ball.vy=v.y*PASS_SPEED; ball.lastTouch=g.side; ball.after=0.16;
          } else {
            const v=norm(dir,0); ball.owner=null; ball.vx=v.x*700; ball.vy=v.y*60; ball.lastTouch=g.side; ball.after=0.1;
          }
        }
      };
      keep(goalieA, boxA, +1); keep(goalieB, boxB, -1);
    }

    // ---------- PHYSICS ----------
    function resolvePlayerCollisions(){
      const all=[...teamA, ...teamB, goalieA, goalieB];
      const radius=p=> (p===goalieA||p===goalieB)?GOALIE_R:PLAYER_R;
      for(let it=0; it<COLLISION_ITERS; it++){
        for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){
          const a=all[i], b=all[j], ra=radius(a), rb=radius(b), min=ra+rb;
          let dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
          if(d<1e-5){ const ang=Math.random()*Math.PI*2; dx=Math.cos(ang)*0.001; dy=Math.sin(ang)*0.001; d=Math.hypot(dx,dy); }
          if(d<min){
            const n={x:dx/d,y:dy/d}, overlap=min-d, push=overlap*0.5;
            a.x+=n.x*push; a.y+=n.y*push; b.x-=n.x*push; b.y-=n.y*push;
            const rel=(a.vx-b.vx)*n.x+(a.vy-b.vy)*n.y, corr=SEP_MIN_VEL-rel;
            if(corr>0){ const imp=corr*0.5; a.vx+=n.x*imp; a.vy+=n.y*imp; b.vx-=n.x*imp; b.vy-=n.y*imp; }
          }
        }
      }
      const clampP=(p,r)=>{ p.x=clamp(p.x,field.left+r,field.right-r); p.y=clamp(p.y,field.top+r,field.bottom-r); };
      [...teamA,...teamB].forEach(p=>clampP(p,PLAYER_R)); clampP(goalieA,GOALIE_R); clampP(goalieB,GOALIE_R);
    }

    function stepPhysics(dt){
      const move=(p,r=PLAYER_R)=>{ p.x=clamp(p.x+p.vx*dt,field.left+r,field.right-r); p.y=clamp(p.y+p.vy*dt,field.top+r,field.bottom-r); };
      teamA.forEach(p=>move(p)); teamB.forEach(p=>move(p)); move(goalieA,GOALIE_R); move(goalieB,GOALIE_R);
      resolvePlayerCollisions();

      const anim=p=>{ const sp=Math.hypot(p.vx,p.vy); const rate=sp>8?(4+(sp/PLAYER_MAX)*8):0; p.animT+=rate*dt; p.animF=Math.floor(p.animT)%4; };
      teamA.forEach(anim); teamB.forEach(anim);

      if(ball.owner){
        if(ball.owner.idx===-1){ const g=keeperOf(ball.owner.team); ball.x=g.x; ball.y=g.y; ball.vx=g.vx*0.2; ball.vy=g.vy*0.2; }
        else { const p=matesOf(ball.owner.team)[ball.owner.idx]; const f=norm(p.vx||p.dirx||(ball.owner.team==='A'?1:-1), p.vy); ball.x=p.x+f.x*(PLAYER_R+BALL_R+2); ball.y=p.y+f.y*(PLAYER_R+BALL_R+2); ball.vx=p.vx*0.6; ball.vy=p.vy*0.6; }
      } else {
        if(ball.after>0){
          let steer=0; if(keys.has('a')||keys.has('arrowleft')) steer-=1; if(keys.has('d')||keys.has('arrowright')) steer+=1;
          if(steer!==0){ const n=norm(ball.vx,ball.vy), perp={x:-n.y,y:n.x}; ball.vx+=perp.x*AFTERTOUCH*dt*steer; ball.vy+=perp.y*AFTERTOUCH*dt*steer; }
          ball.after-=dt;
        }
        ball.vx=expDrag(ball.vx,BALL_DRAG,dt); ball.vy=expDrag(ball.vy,BALL_DRAG,dt);
        ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;

        // goal check before wall bounce (robust scoring)
        const inLeft  = (ball.x - BALL_R <= field.left + 2)  && (ball.y > goalLeft.y  && ball.y < goalLeft.y  + goalLeft.h);
        const inRight = (ball.x + BALL_R >= field.right - 2) && (ball.y > goalRight.y && ball.y < goalRight.y + goalRight.h);
        if(inLeft){ goal('B'); return; }
        if(inRight){ goal('A'); return; }

        // walls
        if(ball.x-BALL_R<field.left){ ball.x=field.left+BALL_R; ball.vx=Math.abs(ball.vx)*RESTITUTION; emitSparks(ball.x,ball.y,6); triggerShake(3); }
        if(ball.x+BALL_R>field.right){ ball.x=field.right-BALL_R; ball.vx=-Math.abs(ball.vx)*RESTITUTION; emitSparks(ball.x,ball.y,6); triggerShake(3); }
        if(ball.y-BALL_R<field.top){ ball.y=field.top+BALL_R; ball.vy=Math.abs(ball.vy)*RESTITUTION; emitSparks(ball.x,ball.y,6); triggerShake(3); }
        if(ball.y+BALL_R>field.bottom){ ball.y=field.bottom-BALL_R; ball.vy=-Math.abs(ball.vy)*RESTITUTION; emitSparks(ball.x,ball.y,6); triggerShake(3); }

        if(Math.hypot(ball.vx,ball.vy)>80) pushTrail();
      }

      // pickup
      if(!ball.owner){
        const tryCap=(tag,arr)=>{ const i=nearestTo(ball,arr); if(i>=0){ const p=arr[i]; if(Math.hypot(p.x-ball.x,p.y-ball.y)<PLAYER_R+DRIBBLE_DIST){ ball.owner={team:tag, idx:i}; ball.lastTouch=tag; if(controlled.team===tag) controlled.idx=i; } } };
        tryCap('A',teamA); if(!ball.owner) tryCap('B',teamB);
      }
    }

    function goal(team){
      if(team==='A'){ score.goalsA++; score.pointsA += 100*score.multA; } else { score.goalsB++; score.pointsB += 100*score.multB; }
      triggerShake(14); emitSparks(field.midX,field.midY,40);
      resetKickoff(team);
    }

    // ---------- RENDER ----------
    const SPR={frame:48,cols:4,rows:8,dest:38}; const STEP=(2*Math.PI)/8;
    function dirRow(vx,vy,f=1){ if(Math.abs(vx)+Math.abs(vy)<6) return f>=0?2:6; let a=Math.atan2(-vy,vx); if(a<0)a+=2*Math.PI; const oct=Math.round(a/STEP)%8; const map=[2,1,0,7,6,5,4,3]; return map[oct]; }
    function drawSprite(p, sheet){ const row=dirRow(p.vx,p.vy,p.dirx||1), col=p.animF%SPR.cols; const sx=col*SPR.frame, sy=row*SPR.frame; ctx.drawImage(sheet, sx, sy, SPR.frame, SPR.frame, p.x-SPR.dest/2, p.y-SPR.dest/2, SPR.dest, SPR.dest); }

    function render(){
      ctx.save(); ctx.translate(shakeX,shakeY);

      // backdrop (Fortnite-ish arena)
      if (imgs.backdrop) ctx.drawImage(imgs.backdrop, 0, 0, W, H);
      else { ctx.fillStyle='#0b1120'; ctx.fillRect(0,0,W,H); }

      // side goal slots (vector neon so we don't need textures)
      ctx.save();
      const drawGoal=(g, color)=>{ ctx.fillStyle=color; ctx.globalAlpha=0.6; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.globalAlpha=1; };
      drawGoal(goalLeft,  'rgba(64,200,255,0.85)');
      drawGoal(goalRight, 'rgba(255,80,170,0.85)');
      ctx.restore();

      // on-field lines
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(field.midX, field.top); ctx.lineTo(field.midX, field.bottom); ctx.stroke();
      circle(field.midX, field.midY, 74, 'rgba(255,255,255,0.22)', 2);
      ctx.strokeRect(field.left, field.midY-penH/2, penW, penH);
      ctx.strokeRect(field.right-penW, field.midY-penH/2, penW, penH);

      // players + keepers
      const sA=imgs.playerBlue, sB=imgs.playerMag;
      const drawP=(p,sheet)=>{ ctx.globalAlpha=0.35; ctx.beginPath(); ctx.ellipse(p.x, p.y+7, 10,4,0,0,Math.PI*2); ctx.fillStyle='#000'; ctx.fill(); ctx.globalAlpha=1; sA&&sB?drawSprite(p,sheet):drawDot(p); if(p.stun>0) circle(p.x,p.y,PLAYER_R+8,'rgba(255,110,110,0.6)',2); };
      teamA.forEach(p=>drawP(p,sA)); teamB.forEach(p=>drawP(p,sB));
      // keepers (use first frame)
      if (sA && sB){ const gA={x:goalieA.x,y:goalieA.y,vx:0,vy:0,dirx:-1,animF:0}; const gB={x:goalieB.x,y:goalieB.y,vx:0,vy:0,dirx:+1,animF:0}; drawSprite(gA,sA); drawSprite(gB,sB); }
      else { drawDot(goalieA,'#38bdf8'); drawDot(goalieB,'#ec4899'); }

      // ball trail + ball
      if(ballTrail.length>2){ for(let i=0;i<ballTrail.length-1;i++){ const t=i/(ballTrail.length-1); ctx.globalAlpha=t*0.25; ctx.beginPath(); ctx.arc(ballTrail[i].x,ballTrail[i].y,BALL_R+2,0,Math.PI*2); ctx.fillStyle='#8bd2ff'; ctx.fill(); } ctx.globalAlpha=1; }
      if(imgs.ball) ctx.drawImage(imgs.ball, ball.x-10, ball.y-10, 20, 20); else drawDot(ball,'#fff',BALL_R);

      // HUD
      ctx.font='24px system-ui, Segoe UI, Roboto, Inter, Arial'; ctx.fillStyle='rgba(255,255,255,0.92)';
      const m=Math.floor(score.time/60).toString().padStart(2,'0'); const s=Math.floor(score.time%60).toString().padStart(2,'0');
      ctx.fillText(`${m}:${s}`, field.midX-24, field.top-18);
      ctx.fillStyle='rgba(64,200,255,1)'; ctx.fillText(String(score.goalsA), field.midX-80, field.top-18);
      ctx.fillStyle='rgba(255,80,170,1)'; ctx.fillText(String(score.goalsB), field.midX+60, field.top-18);

      ctx.font='13px system-ui, Segoe UI, Roboto, Inter, Arial'; ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillText('Move: WASD/Arrows  Pass: J  Shoot: K  Tackle: H/Shift  Switch: L  Dash: Space/Enter  Pause: P', field.left, field.bottom+28);

      // particles
      for(const p of particles){ const a=Math.max(0,p.life/0.4); ctx.fillStyle=`rgba(160,200,255,${a})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }

      ctx.restore();
    }

    function circle(x,y,r,stroke='rgba(255,255,255,0.22)', w=2){ ctx.strokeStyle=stroke; ctx.lineWidth=w; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }
    function drawDot(p,color='#38bdf8',r=PLAYER_R){ ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill(); }

    // ---------- LOOP ----------
    let raf=0, prev=performance.now();
    function sizeAndStart(){
      sizeCanvas();
      window.addEventListener('resize', sizeCanvas);
      window.addEventListener('keydown', onDown, { passive:false });
      window.addEventListener('keyup', onUp);
      window.addEventListener('focus', ensureFocus);
      wrapRef.current?.addEventListener('pointerdown', ensureFocus);
      resetKickoff('B'); ensureFocus();
      raf = requestAnimationFrame(frame);
    }
    function frame(t){
      raf = requestAnimationFrame(frame);
      const dt=Math.min(1/30,(t-prev)/1000); prev=t;
      if(!paused){ controlStep(dt); aiStep(dt); stepPhysics(dt); updateFX(dt); score.time+=dt; }
      render(); justPressed.clear();
    }

    loadImages().then(()=>{ setReady(true); sizeAndStart(); })
                .catch(e=>{ console.error(e); setReady(false); });

    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', sizeCanvas); window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); wrapRef.current?.removeEventListener('pointerdown', ensureFocus); };
  }, [paused]);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className="relative mx-auto h-[calc(100vh-80px)] w-[min(1280px,95vw)]
                 select-none overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3 focus:outline-none"
      style={{ boxShadow:'0 20px 60px rgba(0,0,0,0.45)' }}
    >
      <canvas ref={canvasRef} className="block h-full w-full bg-transparent" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-white/80 p-6 text-center">
          <div>
            <div className="text-lg font-semibold mb-2">Loading arena…</div>
            <p className="text-sm text-white/70">Unzip the v3 bundle into <code>/public/powerplay-assets</code>.</p>
          </div>
        </div>
      )}
      {paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <div className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-white backdrop-blur">
            Paused — press <span className="text-cyan-300">P</span> to resume
          </div>
        </div>
      )}
    </div>
  );
}
