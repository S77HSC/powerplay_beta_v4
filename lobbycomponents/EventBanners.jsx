"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import RotatingTile from "./RotatingTile";

const FALLBACK = [
  { id: "weekend-cup", title: "Weekend Cup", subtitle: "Qualifiers live — ends Sunday 22:00", badge: "Live",
    cta_text: "Join Cup", cta_href: "/tournaments/weekend-cup",
    start_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    end_at:   new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    accent_from: "#06b6d4", accent_to: "#3b82f6", trophy_url: "/trophies/pp_weekendcup.png" },
  { id: "midweek-knockout", title: "Midweek Knockout", subtitle: "One-night bracket — Wed 7pm", badge: "Tonight",
    cta_text: "Register", cta_href: "/tournaments/midweek",
    start_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    end_at:   new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    accent_from: "#22c55e", accent_to: "#16a34a", trophy_url: "/trophies/pp_midweek_cup.png" },
  { id: "rookie-cup", title: "Rookie Cup", subtitle: "Levels 1–10 • prizes for top 50", badge: "New",
    cta_text: "Enter", cta_href: "/tournaments/rookie-cup",
    accent_from: "#f59e0b", accent_to: "#ef4444", trophy_url: "/trophies/pp_rookie_cup.png" },
  { id: "knockout-cup", title: "Knockout Cup", subtitle: "Single elimination — Sat 20:00", badge: "Sign-ups",
    cta_text: "Join", cta_href: "/tournaments/knockout",
    accent_from: "#8b5cf6", accent_to: "#6366f1", trophy_url: "/trophies/pp_knockout_cup.png" },
  { id: "world-cup", title: "World Cup Qualifiers", subtitle: "Global event — coming soon", badge: "Soon",
    cta_text: "Details", cta_href: "/tournaments/world-cup",
    start_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    end_at:   new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
    accent_from: "#eab308", accent_to: "#16a34a", trophy_url: "/trophies/pp_world_cup.png" },
];

const isActive = (item, now = Date.now()) => {
  const s = item.start_at ? Date.parse(item.start_at) : null;
  const e = item.end_at ? Date.parse(item.end_at) : null;
  const afterStart = s ? now >= s : true;
  const beforeEnd  = e ? now <= e : true;
  return afterStart && beforeEnd;
};

export default function EventBanners() {
  const [items, setItems] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("promotions")
          .select("*")
          .order("priority", { ascending: false })
          .limit(20);
        if (error || !alive) return;

        const mapped = (data || []).map(r => ({
          id: r.slug || r.id,
          title: r.title, subtitle: r.subtitle, badge: r.badge,
          cta_text: r.cta_text, cta_href: r.cta_href,
          start_at: r.start_at, end_at: r.end_at,
          accent_from: r.accent_from, accent_to: r.accent_to,
          trophy_url: r.trophy_url || null,
          image_url: r.image_url || null,
        }));

        const activeFromDB = mapped.filter(isActive);
        if (activeFromDB.length > 0) {
          // Prefer DB, but keep fallback trailing (de-duped by id)
          const ids = new Set(activeFromDB.map(x => x.id ?? x.title));
          const merged = [...activeFromDB, ...FALLBACK.filter(f => !ids.has(f.id ?? f.title))];
          setItems(merged);
        } else {
          // Keep fallback — do not blank the tile
          // console.info("[EventBanners] No active DB promos; keeping fallback");
        }
      } catch (e) {
        // console.warn("[EventBanners] fetch failed; keeping fallback:", e?.message || e);
      }
    })();
    return () => { alive = false; };
  }, []);

  const active = useMemo(() => items.filter(isActive), [items]);
  if (!active.length) {
    // absolute safety: show a single neutral card instead of disappearing
    return (
      <div className="absolute right-8 top-24 z-40 w-[520px] max-w-[92vw]">
        <RotatingTile
          items={[{ id: "placeholder", title: "No events right now", subtitle: "Check back soon", badge: "", cta_text: "Browse Play", cta_href: "/play", accent_from: "#475569", accent_to: "#0f172a", trophy_url: "/trophies/pp_world_cup.png" }]}
          variant="sidebar"
          size="lg"
          intervalMs={8000}
        />
      </div>
    );
  }

  return (
    <div className="absolute right-8 top-24 z-40 w-[520px] max-w-[92vw]">
      <RotatingTile items={active} variant="sidebar" size="lg" intervalMs={6000} />
    </div>
  );
}
