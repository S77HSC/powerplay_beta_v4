"use client";
import React, { useEffect, useRef, useState } from "react";

/** Football-Chess v2 (Set-Play)
 * - Possession turn = 3 AP (Move 1, Pass ≤4, Shoot ≤4)
 * - Interception: any pass edge adjacent to a defender ⇒ turnover
 * - Triangle bonus: two consecutive passes involving 3 different players ⇒ +1 AP (max +2 per possession)
 * - If AP hits 0, turnover to nearest opponent to the holder
 * - Same filename/export as before (FootyChess)
 */

const COLS = 12, ROWS = 7;
const CELL = 56, MX = 60, MY = 35;
const W = MX * 2 + COLS * CELL, H = MY * 2 + ROWS * CELL;

const PASS_LIMIT = 4;
const R_PLAYER = 16;

const g2p = (c,r)=>({ x: MX + c*CELL + CELL/2, y: MY + r*CELL + CELL/2 });
const inside = (c,r)=> c>=0 && c<COLS && r>=0 && r<ROWS;
const sgn = (n)=> n===0?0:(n>0?1:-1);

function orthPath(from, to){
  if (from.c!==to.c && from.r!==to.r) return null;
  const dc = sgn(to.c-from.c), dr = sgn(to.r-from.r);
  const cells=[], edges=[]; let c=from.c, r=from.r;
  while (!(c===to.c && r===to.r)){
    const nc=c+dc, nr=r+dr;
    edges.push({ a:{c,r}, b:{c:nc,r:nr} });
    c=nc; r=nr; cells.push({c,r});
  }
  return {cells,edges};
}
function orthPathLimited(from, to, limit){
  const p=orthPath(from,to); if(!p) return null;
  return p.edges.length<=limit ? p : null;
}
function blockedByPieces(pathCells, me, ai){
  const occ=(c,r)=> me.some(p=>p.c===c&&p.r===r) || ai.some(p=>p.c===c&&p.r===r);
  // allow destination to be the receiver (last cell), so only check intermediate cells
  for (let i=0;i<pathCells.length-1;i++){ const {c,r}=pathCells[i]; if(occ(c,r)) return true; }
  return false;
}
// HARD interception: any pass edge adjacent to an opponent piece
function firstHardInterceptEdge(edges, defenders){
  const key=(e)=>`${Math.min(e.a.c,e.b.c)},${Math.min(e.a.r,e.b.r)}-${Math.max(e.a.c,e.b.c)},${Math.max(e.a.r,e.b.r)}`;
  const controlled=new Set();
  for (const d of defenders){
    for (const {dc,dr} of [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}]){
      const a={c:d.c, r:d.r}, b={c:d.c+dc, r:d.r+dr};
      if(inside(b.c,b.r)) controlled.add(key({a,b}));
    }
  }
  for (let i=0;i<edges.length;i++){
    const e=edges[i]; if (controlled.has(key(e))) return i;
  }
  return -1;
}

function nearestIndexTo(holder, list){
  let best=0, bd=1e9;
  list.forEach((p,i)=>{ const d=Math.abs(p.c-holder.c)+Math.abs(p.r-holder.r); if(d<bd){bd=d;best=i;} });
  return best;
}

function initialLayout(){
  return {
    me: [{c:1,r:3},{c:2,r:2},{c:2,r:4},{c:3,r:1},{c:3,r:5}],
    ai: [{c:8,r:2},{c:8,r:4},{c:9,r:3},{c:10,r:5},{c:10,r:1}],
    ball: { team:"me", idx:0 },
    turn: { team:"me", ap:3, bonus:0 }, // bonus = triangle AP earned so far this possession
    lastPassChain: [], // store last two passer keys "me:idx"
    over:false, msg:"Your turn: 3 AP. Move (1), Pass (≤4), or Shoot (≤4 to goal)."
  };
}

export default function FootyChess(){
  const canvasRef = useRef(null);
  const S = useRef(initialLayout());
  const [snap, setSnap] = useState(0);
  const selRef = useRef({ team:"me", idx:0 });

  useEffect(()=>{ draw(); },[snap]);

  // helpers tied to current state
  const isEmpty = (s,c,r)=> !s.me.some(p=>p.c===c&&p.r===r) && !s.ai.some(p=>p.c===c&&p.r===r);
  const isAdjOrth = (a,b)=> Math.abs(a.c-b.c)+Math.abs(a.r-b.r)===1;
  const other = (t)=> t==="me" ? "ai" : "me";
  function listsFor(team){ const s=S.current; return team==="me" ? {mine:s.me, opp:s.ai} : {mine:s.ai, opp:s.me}; }

  // turn control
  function startTurn(team){
    const s=S.current;
    s.turn = { team, ap:3, bonus:0 };
    s.lastPassChain = [];
    s.msg = team==="me"
      ? "Your turn: 3 AP. Move (1), Pass (≤4), or Shoot (≤4 to goal)."
      : "AI turn…";
    setSnap(n=>n+1);
    if (team==="ai") setTimeout(aiTurnStep, 300);
  }

  function turnoverTo(opTeam){
    const s=S.current;
    const curHolder = (s.ball.team==="me" ? s.me[s.ball.idx] : s.ai[s.ball.idx]);
    const { mine:oppList } = listsFor(opTeam);
    const idx = nearestIndexTo(curHolder, oppList);
    s.ball.team = opTeam;
    s.ball.idx = idx;
  }

  function spendAP(n=1){
    const s=S.current;
    s.turn.ap -= n;
    if (s.turn.ap <= 0) {
      // end of possession: turnover to other team near the holder
      const next = other(s.turn.team);
      turnoverTo(next);
      startTurn(next);
    } else {
      setSnap(n=>n+1);
    }
  }

  function recordPass(team, fromIdx, toIdx){
    const s=S.current;
    const keyFrom = `${team}:${fromIdx}`, keyTo = `${team}:${toIdx}`;
    if (s.lastPassChain.length===0) {
      s.lastPassChain=[keyFrom, keyTo];
      return;
    }
    const [a,b] = s.lastPassChain.slice(-2);
    const set = new Set([a,b,keyTo]);
    const threeDistinct = set.size===3 && ![a,b].includes(keyTo);
    s.lastPassChain=[b,keyTo];
    if (threeDistinct && s.turn.bonus < 2) {
      s.turn.ap += 1; s.turn.bonus += 1;
      s.msg = `Triangle! +1 AP (now ${s.turn.ap}).`;
    }
  }

  // human interactions
  useEffect(()=>{
    const c=canvasRef.current;
    const toCell=(e)=>{
      const r=c.getBoundingClientRect();
      const x=(e.clientX-r.left)*(W/r.width);
      const y=(e.clientY-r.top)*(H/r.height);
      const col=Math.floor((x-MX)/CELL);
      const row=Math.floor((y-MY)/CELL);
      return {x,y,c:Math.max(0,Math.min(COLS-1,col)), r:Math.max(0,Math.min(ROWS-1,row))};
    };

    const onClick=(e)=>{
      const s=S.current;
      if (s.over) return;
      if (s.turn.team!=="me") return;

      const { x, c:col, r:row } = toCell(e);
      const { mine, opp } = listsFor("me");
      const holder = mine[s.ball.idx];

      // Clicked my piece?
      const myIdx = mine.findIndex(p=>p.c===col && p.r===row);
      if (myIdx>=0){
        selRef.current={ team:"me", idx:myIdx };
        s.msg = `Selected #${myIdx+1}. Move (1 AP) or click a teammate to pass (1 AP).`;
        setSnap(n=>n+1);
        return;
      }

      // Clicked empty: attempt a move for selected piece
      const sel = mine[selRef.current.idx];
      if (sel && isAdjOrth(sel,{c:col,r:row}) && isEmpty(s,col,row)){
        sel.c=col; sel.r=row;
        s.msg = `Moved. AP left: ${s.turn.ap-1}`;
        spendAP(1);
        return;
      }

      // Clicked a teammate as receiver to pass
      const recvIdx = mine.findIndex(p=>p.c===col && p.r===row);
      if (recvIdx>=0 && recvIdx!==s.ball.idx){
        const fromIdx = s.ball.idx;             // store before reassigning
        const path = orthPathLimited(holder, mine[recvIdx], PASS_LIMIT);
        if (!path) { s.msg="Pass must be straight and ≤4."; setSnap(n=>n+1); return; }
        if (blockedByPieces(path.cells, s.me, s.ai)) { s.msg="Lane blocked."; setSnap(n=>n+1); return; }
        const hard = firstHardInterceptEdge(path.edges, opp);
        if (hard>=0){
          // Intercept -> AI ball near the interception (nearest defender to the risky edge)
          turnoverTo("ai");
          s.msg="Intercepted! AI ball.";
          startTurn("ai");
          return;
        }
        // success
        s.ball.idx = recvIdx;
        s.msg = `Pass complete. AP left: ${s.turn.ap-1}`;
        recordPass("me", fromIdx, recvIdx);
        spendAP(1);
        return;
      }

      // Shoot if clicking goal strip beyond right edge in same row
      const clickRightGoal = x > W - MX - 10;
      if (clickRightGoal){
        const A = holder;
        const path = orthPathLimited(A, { c: COLS-1, r: A.r }, PASS_LIMIT);
        if (path && !blockedByPieces(path.cells, s.me, s.ai)){
          const hard = firstHardInterceptEdge(path.edges, opp);
          if (hard<0) { s.over=true; s.msg="GOAL! 🎉"; setSnap(n=>n+1); return; }
          // blocked shot → AI ball
          turnoverTo("ai"); s.msg="Shot blocked! AI ball."; startTurn("ai"); return;
        } else { s.msg="Shot lane blocked or too far (>4)."; setSnap(n=>n+1); }
      }
    };

    c.addEventListener("click", onClick);
    return ()=> c.removeEventListener("click", onClick);
  },[]);

  // AI turn (simple & readable)
  function aiTurnStep(){
    const s=S.current; if (s.over) return;
    if (s.turn.team!=="ai") return;

    const { mine:AI, opp:ME } = listsFor("ai");

    // If AI has ball:
    if (s.ball.team==="ai"){
      const A = AI[s.ball.idx];

      // 1) Try goal pass left ≤4
      const goal = orthPathLimited(A, { c:0, r:A.r }, PASS_LIMIT);
      if (goal && !blockedByPieces(goal.cells, s.me, s.ai)){
        const hard = firstHardInterceptEdge(goal.edges, ME);
        if (hard<0){ s.over=true; s.msg="AI scored."; setSnap(n=>n+1); return; }
      }

      // 2) Try progressive pass ≤4 to furthest left in same row
      const receivers = AI
        .map((p,i)=>({p,i}))
        .filter(({p,i})=> i!==s.ball.idx && p.r===A.r && A.c-p.c>0 && (A.c-p.c)<=PASS_LIMIT)
        .sort((u,v)=> u.p.c - v.p.c); // furthest left first
      for (const {p,i} of receivers){
        const path = orthPathLimited(A,p,PASS_LIMIT);
        if (path && !blockedByPieces(path.cells, s.me, s.ai)){
          const hard = firstHardInterceptEdge(path.edges, ME);
          if (hard<0){
            s.ball.idx=i; s.turn.ap--; s.msg=`AI pass. AP left: ${s.turn.ap}`;
            if (s.turn.ap<=0) { endAiTurn(); return; }
            setSnap(n=>n+1); setTimeout(aiTurnStep, 220); return;
          } else {
            // You intercept ⇒ your ball
            turnoverTo("me"); startTurn("me"); return;
          }
        }
      }

      // 3) Else carry 1 left if empty
      const opts=[{c:A.c-1,r:A.r},{c:A.c,r:A.r-1},{c:A.c,r:A.r+1}].filter(q=>inside(q.c,q.r));
      const mv = opts.find(q=> isEmpty(s,q.c,q.r) );
      if (mv){ A.c=mv.c; A.r=mv.r; s.turn.ap--; s.msg=`AI carry. AP left: ${s.turn.ap}`; }
      else { s.turn.ap--; s.msg=`AI stuck. AP left: ${s.turn.ap}`; }

      if (s.turn.ap<=0) { endAiTurn(); return; }
      setSnap(n=>n+1); setTimeout(aiTurnStep, 220); return;
    }

    // AI defending (no ball): close lanes with up to remaining AP
    const H = ME[S.current.ball.idx]; // your holder
    const furthest = ME.filter(p=>p.r===H.r && p.c>H.c).sort((a,b)=>b.c-a.c)[0] || {c:H.c+1,r:H.r};
    const lane = orthPath(H, furthest) || { edges:[{a:H,b:furthest}] };
    for (let moved=0; moved<Math.min(2, s.turn.ap); moved++){
      let pick=-1, best=1e9; const edge=lane.edges[Math.min(moved, lane.edges.length-1)];
      AI.forEach((d,i)=>{
        const mid = g2p((edge.a.c+edge.b.c)/2,(edge.a.r+edge.b.r)/2);
        const P=g2p(d.c,d.r); const dd=Math.hypot(P.x-mid.x, P.y-mid.y);
        if (dd<best){best=dd;pick=i;}
      });
      if (pick>=0){
        const d=AI[pick];
        const step=(f,t)=> Math.max(-1, Math.min(1, t-f));
        const tc=Math.round((edge.a.c+edge.b.c)/2), tr=Math.round((edge.a.r+edge.b.r)/2);
        const nc=d.c + step(d.c, tc), nr=d.r + step(d.r, tr);
        if (inside(nc,nr) && isEmpty(s,nc,nr)) { d.c=nc; d.r=nr; }
        s.turn.ap--;
        if (s.turn.ap<=0) break;
      }
    }
    s.msg = `AI blocks. Your turn.`;
    endAiTurn();
  }

  function endAiTurn(){
    const s=S.current;
    if (s.over) { setSnap(n=>n+1); return; }
    startTurn("me");
  }

  // drawing
  function draw(){
    const ctx = canvasRef.current.getContext("2d");
    const s=S.current;
    ctx.clearRect(0,0,W,H);

    // pitch bg
    ctx.fillStyle="#0b3a2e"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,0.05)";
    ctx.fillRect(MX + Math.floor(COLS/3)*CELL, MY, Math.floor(COLS/3)*CELL, ROWS*CELL);

    // grid
    ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1;
    for(let c=0;c<=COLS;c++){ const x=MX+c*CELL; ctx.beginPath(); ctx.moveTo(x,MY); ctx.lineTo(x,MY+ROWS*CELL); ctx.stroke(); }
    for(let r=0;r<=ROWS;r++){ const y=MY+r*CELL; ctx.beginPath(); ctx.moveTo(MX,y); ctx.lineTo(MX+COLS*CELL,y); ctx.stroke(); }

    // boxes + goals
    ctx.fillStyle="rgba(255,255,255,0.08)";
    ctx.fillRect(MX, MY+CELL, 2*CELL, ROWS*CELL-2*CELL);
    ctx.fillRect(MX+(COLS-2)*CELL, MY+CELL, 2*CELL, ROWS*CELL-2*CELL);
    ctx.fillStyle="rgba(255,255,255,0.12)";
    ctx.fillRect(W-MX-8, MY+2*CELL, 8, ROWS*CELL-4*CELL); // right goal
    ctx.fillRect(MX,      MY+2*CELL, 8, ROWS*CELL-4*CELL); // left goal

    // threatened edges overlay (your turn): teaches lane reading
    if (s.turn.team==="me"){
      ctx.strokeStyle="rgba(255,80,80,0.35)"; ctx.lineWidth=3;
      for (const d of s.ai){
        for (const step of [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}]){
          const a={c:d.c, r:d.r}, b={c:d.c+step.dc, r:d.r+step.dr};
          if (!inside(b.c,b.r)) continue;
          const A=g2p(a.c,a.r), B=g2p(b.c,b.r);
          ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
        }
      }
    }

    // players
    const drawGuy=(p,a,b)=>{
      const {x,y}=g2p(p.c,p.r);
      const grad=ctx.createLinearGradient(x-8,y-8,x+8,y+8); grad.addColorStop(0,a); grad.addColorStop(1,b);
      ctx.beginPath(); ctx.arc(x,y,R_PLAYER,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.45)"; ctx.stroke();
    };
    s.me.forEach(p=>drawGuy(p,"#38bdf8","#22c55e"));
    s.ai.forEach(p=>drawGuy(p,"#ef4444","#f59e0b"));

    // ball indicator
    const holder = (s.ball.team==="me" ? s.me[s.ball.idx] : s.ai[s.ball.idx]);
    const hb=g2p(holder.c,holder.r);
    ctx.fillStyle="#ffe18a"; ctx.beginPath(); ctx.arc(hb.x, hb.y-22, 6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.4)"; ctx.stroke();

    // HUD
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,0,W,58);
    ctx.fillStyle="#fff"; ctx.font="900 20px Inter,system-ui,sans-serif";
    ctx.textAlign="left";  ctx.fillText(`AP: ${s.turn.ap}  (Triangle bonus used: ${s.turn.bonus}/2)`, 16, 36);
    ctx.textAlign="center";ctx.fillText(s.msg || "", W/2, 36);
    ctx.textAlign="right"; ctx.fillText(`${s.turn.team.toUpperCase()} TURN`, W-16, 36);

    if (s.over){
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.font="900 34px Inter,system-ui,sans-serif";
      ctx.textAlign="center"; ctx.fillText("Full time", W/2, H/2-28);
      ctx.font="700 22px Inter,system-ui,sans-serif";
      ctx.fillText(s.msg || "Game over", W/2, H/2+8);
    }
  }

  const restart=()=>{ S.current=initialLayout(); setSnap(n=>n+1); };
  useEffect(()=>{ startTurn("me"); },[]);

  return (
    <div className="grid place-items-center gap-3">
      <canvas ref={canvasRef} width={W} height={H} className="rounded-xl border border-white/10 bg-black/20"/>
      <div className="flex items-center gap-3">
        <button onClick={restart} className="rounded-xl bg-yellow-400 px-5 py-2 text-black font-bold hover:brightness-95">
          Restart
        </button>
      </div>
      <p className="text-white/70 text-sm max-w-2xl text-center">
        Possession = 3 AP. Move 1, Pass ≤4, or Shoot ≤4. Pass edges adjacent to defenders are intercepted.
        Two passes involving three different players grant +1 AP (triangle bonus, max +2 per possession).
      </p>
    </div>
  );
}
