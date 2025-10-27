// lobbycomponents/TrophyShelf.jsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * TrophyShelf
 * Props:
 *  - playerId: number (required)
 *  - cadence: 'weekly' | 'daily' | 'all'  (default 'all')
 *  - realtime: boolean (default true)
 *  - variant: 'compact' | 'banner' (default 'compact')
 *  - thumbPx: number (default 96)   -> image size for compact tiles
 *  - heroPx: number (default 180)   -> banner height for banner tiles
 */
export default function TrophyShelf({
  playerId,
  cadence = "all",
  realtime = true,
  variant = "compact",
  thumbPx = 96,
  heroPx = 180,
}) {
  const ready = useMemo(() => Number.isFinite(Number(playerId)) && Number(playerId) > 0, [playerId]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const cadenceFilter = useMemo(() => {
    const v = String(cadence || "all").toLowerCase();
    return v === "weekly" || v === "daily" ? v : null; // null => all
  }, [cadence]);

  const resolveIconUrl = (icon) => {
    if (!icon) return null;
    if (/^https?:\/\//i.test(icon)) return icon;
    if (icon.startsWith("/")) return icon;
    return `/trophies/${icon}`; // bare filename -> /trophies/...
  };

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

  // Prefer server-side weekly view ONLY when cadence === 'weekly'
  const fetchFromWeeklyView = useCallback(async () => {
    const q = supabase
      .from("v_player_weekly_trophies")
      .select(
        "id, player_id, trophy_code, period_start, awarded_at, metrics, name, description, icon_url, slug, weight"
      )
      .eq("player_id", playerId)
      .order("period_start", { ascending: false })
      .limit(200);
    return q;
  }, [playerId]);

  // Generic client-side join for all/daily/weekly
  const fetchClientJoin = useCallback(async () => {
    const awardsQ = supabase
      .from("trophy_awards")
      .select("id, player_id, user_id, trophy_code, period_start, metrics, created_at")
      .eq("player_id", playerId)
      .order("period_start", { ascending: false })
      .limit(300);

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
        weight: t.weight ?? 0,
        cadence: (t.cadence || "").toLowerCase(), // 'weekly' | 'daily' | etc
      };
    });

    const filtered = cadenceFilter ? merged.filter((r) => r.cadence === cadenceFilter) : merged;
    return { data: filtered, error: null };
  }, [playerId, cadenceFilter]);

  const fetchTrophies = useCallback(async () => {
    if (!ready) return;
    setLoading(true);

    if (!cadenceFilter || cadenceFilter === "daily") {
      const fb = await fetchClientJoin();
      if (!fb.error) setRows(fb.data || []);
      setLoading(false);
      return;
    }

    let viaView = null;
    try {
      viaView = await fetchFromWeeklyView();
      if (viaView?.error && viaView.error.code === "PGRST116") viaView = null;
    } catch {
      viaView = null;
    }

    if (viaView && !viaView.error) {
      setRows(viaView.data || []);
      setLoading(false);
      return;
    }

    const fb = await fetchClientJoin();
    if (!fb.error) setRows(fb.data || []);
    setLoading(false);
  }, [ready, cadenceFilter, fetchClientJoin, fetchFromWeeklyView]);

  useEffect(() => { fetchTrophies(); }, [fetchTrophies]);

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
    return () => { supabase.removeChannel(channel); };
  }, [ready, realtime, playerId, fetchTrophies]);

  if (!ready) return null;

  // Compact card component
  const CompactCard = ({ r }) => {
    const iconSrc = resolveIconUrl(r.icon_url);
    const dayOrWeek = r.cadence === "daily" ? "Day" : "Week starting";

    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm hover:bg-white/10 transition">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20"
            style={{ width: thumbPx, height: thumbPx }}
          >
            {iconSrc ? (
              <img
                src={iconSrc}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">🏆</div>
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-6">
              {r.name || r.trophy_code}
            </div>
            <div className="mt-0.5 text-[13px] text-white/80">
              {dayOrWeek}: {r.period_start ? new Date(r.period_start).toLocaleDateString() : "—"}
            </div>
            {r.awarded_at && (
              <div className="text-[12px] text-white/60">
                Awarded: {new Date(r.awarded_at).toLocaleString()}
              </div>
            )}

            {!!r.metrics && Object.keys(r.metrics || {}).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/80">
                {Object.entries(r.metrics).map(([k, v]) => (
                  <span key={k} className="whitespace-nowrap">
                    <span className="text-white/60">{String(k).toUpperCase()}:</span>{" "}
                    <span className="font-mono">{prettyMetric(k, v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Banner card component (optional)
  const BannerCard = ({ r }) => {
    const iconSrc = resolveIconUrl(r.icon_url);
    const dayOrWeek = r.cadence === "daily" ? "Day" : "Week starting";

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
        {iconSrc && (
          <div
            className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"
            style={{ height: `${heroPx}px` }}
          >
            <img src={iconSrc} alt="" className="h-full w-full object-contain" loading="lazy" />
          </div>
        )}

        <div className="mb-1 text-lg font-semibold">{r.name || r.trophy_code}</div>
        <div className="mt-1 text-sm text-white/80">
          {dayOrWeek}: {r.period_start ? new Date(r.period_start).toLocaleDateString() : "—"}
        </div>
        {r.awarded_at && (
          <div className="text-xs text-white/60">Awarded: {new Date(r.awarded_at).toLocaleString()}</div>
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
    );
  };

  return (
    <div>
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">Loading trophies…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80">
          No trophies yet — keep going! 💪
        </div>
      ) : (
        <div
          className={
            variant === "compact"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {rows.map((r) =>
            variant === "compact" ? <CompactCard key={r.id} r={r} /> : <BannerCard key={r.id} r={r} />
          )}
        </div>
      )}
    </div>
  );
}
