// lobbycomponents/TrophyShelf.jsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * TrophyShelf
 * Props:
 *  - playerId: number (required)
 *  - cadence: 'weekly' | 'daily' | 'all'  (default 'weekly')
 *  - realtime: boolean (default true) – subscribe to live inserts
 */
export default function TrophyShelf({ playerId, cadence = "weekly", realtime = true }) {
  const ready = useMemo(() => Number.isFinite(Number(playerId)) && Number(playerId) > 0, [playerId]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const cadenceFilter = useMemo(() => {
    if (cadence === "all") return undefined;
    return String(cadence).toLowerCase();
  }, [cadence]);

  const prettyMetric = (k, v) => {
    const key = String(k).toUpperCase();
    if (key === "WORK_TIME") {
      const mins = Number(v) || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    }
    if (typeof v === "number") return v.toLocaleString();
    return String(v);
  };

  const fetchFromView = useCallback(async () => {
    // v_player_weekly_trophies: (id, player_id, trophy_code, period_start, awarded_at, metrics, name, description, icon_url, slug, weight)
    const q = supabase
      .from("v_player_weekly_trophies")
      .select("id, player_id, trophy_code, period_start, awarded_at, metrics, name, description, icon_url, slug, weight")
      .eq("player_id", playerId)
      .order("period_start", { ascending: false })
      .limit(200);

    // If user wants only weekly, the view already filters that. For other cadences we’ll fall back.
    return q;
  }, [playerId]);

  const fetchClientJoin = useCallback(async () => {
    // Fallback path: fetch awards + the catalog and merge client-side
    const awardsQ = supabase
      .from("trophy_awards")
      .select("id, player_id, user_id, trophy_code, period_start, metrics, created_at")
      .eq("player_id", playerId)
      .order("period_start", { ascending: false })
      .limit(200);

    const trophiesQ = supabase
      .from("trophies")
      .select("code, name, cadence, description, icon_url, slug, weight");

    const [awards, catalog] = await Promise.all([awardsQ, trophiesQ]);
    if (awards.error) throw awards.error;
    if (catalog.error) throw catalog.error;

    const byCode = Object.fromEntries((catalog.data ?? []).map((t) => [t.code, t]));
    const merged = (awards.data ?? []).map((a) => {
      const t = byCode[a.trophy_code] || {};
      return {
        id: a.id,
        player_id: a.player_id,
        trophy_code: a.trophy_code,
        period_start: a.period_start,
        awarded_at: a.created_at,
        metrics: a.metrics,
        name: t.name || a.trophy_code,
        description: t.description || null,
        icon_url: t.icon_url || null,
        slug: t.slug || null,
        weight: t.weight || null,
        cadence: t.cadence || null,
      };
    });

    // optional cadence filter (weekly/daily/all)
    const filtered =
      cadenceFilter ? merged.filter((r) => (r.cadence || "").toLowerCase() === cadenceFilter) : merged;

    return { data: filtered, error: null };
  }, [playerId, cadenceFilter]);

  const fetchTrophies = useCallback(async () => {
    if (!ready) return;
    setLoading(true);

    // Try view first (best: server-side join)
    let viaView = null;
    try {
      viaView = await fetchFromView();
      if (viaView.error && viaView.error.code === "PGRST116") {
        // table/view not found -> fallback
        viaView = null;
      }
    } catch {
      viaView = null;
    }

    if (viaView && !viaView.error) {
      // If cadence !== weekly and you have other cadence views, adjust here.
      // Otherwise, for non-weekly we’ll just fallback to client join.
      if (cadenceFilter && cadenceFilter !== "weekly") {
        const fb = await fetchClientJoin();
        if (!fb.error) setRows(fb.data || []);
        setLoading(false);
        return;
      }
      setRows(viaView.data || []);
      setLoading(false);
      return;
    }

    // Fallback client join
    const fb = await fetchClientJoin();
    if (!fb.error) setRows(fb.data || []);
    setLoading(false);
  }, [ready, fetchFromView, fetchClientJoin, cadenceFilter]);

  useEffect(() => {
    fetchTrophies();
  }, [fetchTrophies]);

  // Optional realtime: refetch when a trophy_awards row is inserted for this player
  useEffect(() => {
    if (!ready || !realtime) return;
    const channel = supabase
      .channel("trophies-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trophy_awards", filter: `player_id=eq.${playerId}` },
        () => fetchTrophies()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, realtime, playerId, fetchTrophies]);

  if (!ready) return null;

  return (
    <div>
      {/* Loading / empty states */}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">Loading trophies…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">
          No trophies yet — keep going! 💪
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="text-2xl">
                  {r.icon_url ? (
                    <img src={r.icon_url} alt="" className="inline-block h-6 w-6" />
                  ) : (
                    "🏆"
                  )}
                </div>
                <div className="font-semibold">{r.name || r.trophy_code}</div>
              </div>

              <div className="mt-1 text-sm text-white/80">
                Week starting:{" "}
                {r.period_start ? new Date(r.period_start).toLocaleDateString() : "—"}
              </div>
              {r.awarded_at && (
                <div className="text-xs text-white/60">
                  Awarded: {new Date(r.awarded_at).toLocaleString()}
                </div>
              )}

              {!!r.metrics && Object.keys(r.metrics || {}).length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs text-white/80">
                  {Object.entries(r.metrics).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-white/60">{String(k).toUpperCase()}:</span>{" "}
                      <span className="font-mono">{prettyMetric(k, v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
