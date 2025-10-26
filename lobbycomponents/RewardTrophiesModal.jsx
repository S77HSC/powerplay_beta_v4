// RewardTrophiesModal.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase"; // match your path

const TZ = "Europe/London";
const weekStartYMD = () => {
  const p = new Intl.DateTimeFormat("en-GB",{ timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date())
    .reduce((a,p)=>(a[p.type]=p.value,a),{});
  const d = new Date(Date.UTC(+p.year, +p.month-1, +p.day));
  const dow = (d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-dow);
  return d.toISOString().slice(0,10);
};

export default function RewardTrophiesModal({ open, onClose, playerId }) {
  const [rows, setRows] = useState([]);
  const [players, setPlayers] = useState({});
  const [loading, setLoading] = useState(false);
  const period = useMemo(() => weekStartYMD(), []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      // read awards for this week
      const { data, error } = await supabase
        .from("trophy_awards")
        .select("trophy_code, player_id, metrics, created_at, user_id")
        .eq("period_start", period)
        .order("trophy_code", { ascending: true });
      if (!error && data) {
        setRows(data);
        // fetch player display (name/avatar) for winners
        const ids = [...new Set(data.map(d=>d.player_id))];
        if (ids.length) {
          const { data: ps } = await supabase
            .from("players")
            .select("id,name,avatar_url,player_status,points")
            .in("id", ids);
          const map = {}; (ps||[]).forEach(p=>map[p.id]=p);
          setPlayers(map);
        }
      }
      setLoading(false);
    })();
  }, [open, period]);

  const groups = useMemo(() => {
    const g = new Map();
    for (const r of rows) {
      if (!g.has(r.trophy_code)) g.set(r.trophy_code, []);
      g.get(r.trophy_code).push(r);
    }
    return g;
  }, [rows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[92vw] max-w-3xl rounded-2xl border border-white/10 bg-neutral-900/95 p-4 text-white" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Weekly Trophies</div>
          <button onClick={onClose} className="rounded-md bg-white/10 px-3 py-1 text-xs hover:bg-white/20">Close</button>
        </div>

        <div className="mt-2 text-xs text-white/70">Week starting {period} (London)</div>

        {loading ? (
          <div className="mt-6 text-sm text-white/70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            No trophies have been awarded yet this week.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {[
              { code:"player_week", label:"Player of the Week", color:"from-amber-400/20 to-amber-600/10" },
              { code:"grinder_week", label:"Grinder (Weekly)", color:"from-emerald-400/20 to-emerald-600/10" },
              { code:"iron_week", label:"Iron Lungs (Weekly)", color:"from-sky-400/20 to-sky-600/10" },
              { code:"improved_week", label:"Most Improved", color:"from-fuchsia-400/20 to-fuchsia-600/10" },
              { code:"pb_week", label:"Personal Best", color:"from-lime-400/20 to-lime-600/10" },
            ].map(({code,label,color}) => (
              <div key={code} className="rounded-xl border border-white/10 bg-gradient-to-r p-3 sm:p-4 " style={{ backgroundImage:`linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to))`}} >
                <div className="text-sm font-semibold mb-2">{label}</div>
                <div className="grid gap-2">
                  {(groups.get(code) || []).map((r) => {
                    const p = players[r.player_id] || {};
                    const mine = playerId && r.player_id === Number(playerId);
                    return (
                      <div key={`${code}-${r.player_id}`} className={`flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 ${mine ? "ring-1 ring-yellow-400" : ""}`}>
                        <div className="flex items-center gap-3">
                          <img src={p.avatar_url || "/avatars/default.png"} className="h-8 w-8 rounded-full object-cover" alt="" />
                          <div>
                            <div className="text-sm font-medium">{p.name || `Player #${r.player_id}`}{mine ? " • You" : ""}</div>
                            <div className="text-xs text-white/70">
                              {Object.entries(r.metrics || {}).map(([k,v]) => `${k}:${v}`).join("  •  ")}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-white/70">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    );
                  })}
                  {(groups.get(code) || []).length === 0 && (
                    <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/70">No winner for this trophy yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
