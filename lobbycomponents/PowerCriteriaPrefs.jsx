'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function PowerCriteriaPrefs({ authId }) {
  const supabase = getSupabaseBrowserClient();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // read by auth_id
      const { data, error } = await supabase
        .from('player_power_prefs')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();
      if (!active) return;
      if (error) console.warn(error.message);
      setPrefs(
        data ?? {
          w_time: 0.4, w_reps: 0.2, w_touches: 0.3, w_streak: 0.1, w_challenges: 0.2,
          dist_power: 0.34, dist_speed: 0.33, dist_control: 0.33,
        }
      );
    })();
    return () => { active = false; };
  }, [authId, supabase]);

  // Normalize “what counts” to ≈sum 1 for display & saving
  const normPrefs = useMemo(() => {
    if (!prefs) return null;
    const sum = prefs.w_time + prefs.w_reps + prefs.w_touches + prefs.w_streak + prefs.w_challenges;
    const f = sum > 0 ? (v) => v / sum : (v) => v;
    return { ...prefs,
      w_time: f(prefs.w_time), w_reps: f(prefs.w_reps), w_touches: f(prefs.w_touches),
      w_streak: f(prefs.w_streak), w_challenges: f(prefs.w_challenges)
    };
  }, [prefs]);

  async function save() {
    if (!normPrefs) return;
    setSaving(true);
    const { error } = await supabase.from('player_power_prefs').upsert({
      auth_id: authId,
      ...normPrefs,
      updated_at: new Date().toISOString(),
    });
    if (error) alert(error.message);
    setSaving(false);
  }

  if (!prefs) return null;

  const sliders = [
    ['w_time','Time trained'], ['w_reps','Reps'], ['w_touches','Touches'], ['w_streak','Streak'], ['w_challenges','Challenges']
  ];
  const split = [['dist_power','Power'],['dist_speed','Speed'],['dist_control','Control']];

  const percent = (k, denom) =>
    Math.round((prefs[k] / (denom || 1)) * 100);

  const denomWeights = prefs.w_time + prefs.w_reps + prefs.w_touches + prefs.w_streak + prefs.w_challenges;
  const denomSplit   = prefs.dist_power + prefs.dist_speed + prefs.dist_control;

  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="mb-2 text-sm font-semibold text-white">Training criteria</div>
      {sliders.map(([k,label]) => (
        <label key={k} className="mb-2 block text-xs text-white/80">
          <div className="mb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="tabular-nums text-white/60">{percent(k, denomWeights)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            value={prefs[k]}
            onChange={(e)=>setPrefs({...prefs, [k]: Number(e.target.value)})}
            className="w-full accent-white"
          />
        </label>
      ))}

      <div className="mt-4 text-sm font-semibold text-white">Stat split</div>
      {split.map(([k,label]) => (
        <label key={k} className="mb-2 block text-xs text-white/80">
          <div className="mb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="tabular-nums text-white/60">{percent(k, denomSplit)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={prefs[k]}
            onChange={(e)=>setPrefs({...prefs, [k]: Number(e.target.value)})}
            className="w-full accent-white"
          />
        </label>
      ))}

      <button
        onClick={save}
        className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15"
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  );
}
