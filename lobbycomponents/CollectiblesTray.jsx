"use client";

// Carousel with portal-based modal (escapes clipping from scaled/overflow ancestors)
// • Arrow buttons scroll a “page” of cards
// • Drag to scroll (mouse/touch)
// • Modal uses --app-vh + safe-area insets so it fits on iPad/iPhone

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase"; // ← change to "../../lib/supabase" if your helper is at project root

const RARITY = {
  legendary: { ring: "from-yellow-300 to-orange-500", glow: "shadow-[0_0_24px_#FFD700]" },
  epic:      { ring: "from-fuchsia-400 to-purple-600", glow: "shadow-[0_0_24px_#b26dff]" },
  rare:      { ring: "from-sky-400 to-blue-600",       glow: "shadow-[0_0_24px_#4cc9f0]" },
  common:    { ring: "from-slate-300 to-slate-500",    glow: "shadow-[0_0_18px_rgba(148,163,184,0.6)]" },
};

/* ---------- Modal portal helper ---------- */
function useBodyPortal(isOpen) {
  const [mounted, setMounted] = useState(false);
  const elRef = useRef(null);
  if (!elRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.setAttribute("data-modal-root", "true");
    el.style.position = "relative";
    el.style.zIndex = "9999"; // <- ensure portal sits above the lobby's transformed stage
    elRef.current = el;
  }
  useEffect(() => {
    if (!elRef.current) return;
    document.body.appendChild(elRef.current);
    setMounted(true);
    return () => {
      try { document.body.removeChild(elRef.current); } catch {}
      setMounted(false);
    };
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);
  return mounted ? elRef.current : null;
}

export default function CollectiblesTray({ orbitronClass = "", player_id, playerId }) {
  const pid = Number(player_id ?? playerId);
  const hasPid = Number.isFinite(pid);

  const [cards, setCards] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);

  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [itemSize, setItemSize] = useState({ w: 104, gap: 12 });

  /* ---------- Data ---------- */
  const loadCards = useCallback(async () => {
    if (!hasPid) return;
    const { data } = await supabase
      .from("user_cards")
      .select("id, is_equipped, obtained_at, cards:card_id(name, rarity, image_url)")
      .eq("player_id", pid)
      .order("obtained_at", { ascending: false });

    setCards((data || []).map((r) => ({
      user_card_id: r.id,
      is_equipped: !!r.is_equipped,
      obtained_at: r.obtained_at,
      name: r.cards?.name || "Card",
      rarity: r.cards?.rarity || "common",
      image_url: r.cards?.image_url || "/player-cards/a_iniesta_epic.png",
    })));
  }, [hasPid, pid]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // measure one card for page-wise scrolling
  useEffect(() => {
    const el = trackRef.current?.querySelector("[data-card]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setItemSize((s) => ({ ...s, w: r.width }));
  }, [cards.length]);

  const pageSize = useMemo(() => {
    const vpW = viewportRef.current?.clientWidth ?? 680;
    return Math.max(1, Math.floor((vpW - 16) / (itemSize.w + itemSize.gap)));
  }, [itemSize.w, itemSize.gap]);

  const scrollByItems = (n) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const delta = n * (itemSize.w + itemSize.gap) * pageSize;
    vp.scrollBy({ left: delta, behavior: "smooth" });
  };

  // drag-to-scroll
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let isDown = false, startX = 0, startLeft = 0;

    const onDown = (e) => {
      isDown = true;
      vp.classList.add("cursor-grabbing");
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startLeft = vp.scrollLeft;
    };
    const onMove = (e) => {
      if (!isDown) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      const dx = x - startX;
      vp.scrollLeft = startLeft - dx;
    };
    const onUp = () => { isDown = false; vp.classList.remove("cursor-grabbing"); };

    vp.addEventListener("mousedown", onDown);
    vp.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    vp.addEventListener("touchstart", onDown, { passive: true });
    vp.addEventListener("touchmove", onMove, { passive: true });
    vp.addEventListener("touchend", onUp);

    return () => {
      vp.removeEventListener("mousedown", onDown);
      vp.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      vp.removeEventListener("touchstart", onDown);
      vp.removeEventListener("touchmove", onMove);
      vp.removeEventListener("touchend", onUp);
    };
  }, []);

  async function equipCard(user_card_id) {
    if (!hasPid || loading) return;
    setLoading(true);
    try {
      await supabase.from("user_cards").update({ is_equipped: false }).eq("player_id", pid).eq("is_equipped", true);
      await supabase.from("user_cards").update({ is_equipped: true }).eq("id", user_card_id).eq("player_id", pid);
      await loadCards();
      window.dispatchEvent(new Event("cards:updated"));
    } finally { setLoading(false); }
  }

  /* ---------- UI ---------- */
  const modalRoot = useBodyPortal(Boolean(active));

  return (
    <div className="relative select-none rounded-3xl border border-white/10 bg-gradient-to-br from-black/15 via-black/8 to-gray-900/15 backdrop-blur-sm p-3 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
      {/* Title + arrows */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold tracking-wide text-yellow-300">
          <span>🎴</span> Collectables
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => scrollByItems(-1)} className="h-8 w-8 grid place-items-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/15" aria-label="previous">‹</button>
          <button onClick={() => scrollByItems(1)}  className="h-8 w-8 grid place-items-center rounded-full bg-white/10 ring-1 ring-white/15 hover:bg-white/15"  aria-label="next">›</button>
        </div>
      </div>

      {/* Carousel viewport */}
      <div ref={viewportRef} className="hide-scrollbar relative overflow-hidden cursor-grab" style={{ paddingBottom: 4 }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        />
        <div ref={trackRef} className="flex items-stretch gap-3 will-change-transform">
          {cards.map((c) => {
            const r = RARITY[c.rarity] || RARITY.common;
            return (
              <button
                data-card
                key={c.user_card_id}
                onClick={() => setActive(c)}
                className={`relative shrink-0 rounded-lg bg-gradient-to-br ${r.ring} p-[1.5px]`}
                style={{ width: "clamp(92px, 12vw, 112px)", height: "clamp(130px, 17vw, 156px)" }}
              >
                <div className={`relative flex h-full w-full flex-col items-center justify-between rounded-[8px] bg-black/55 ${r.glow} p-2 overflow-hidden`}>
                  <div className="flex w-full items-center justify-between text-[7px] text-white/80">
                    <span className="rounded bg-white/8 px-1 py-0.5 uppercase tracking-wider">{c.rarity}</span>
                    <span className="opacity-60">#{String(c.user_card_id).slice(0, 3)}</span>
                  </div>
                  <div className="relative mx-auto flex h-[84px] w-full items-center justify-center overflow-hidden">
                    <img src={c.image_url} alt={c.name} className="pointer-events-none block h-20 w-20 object-contain" draggable={false} />
                    {c.is_equipped && (
                      <div className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 rounded-[6px] bg-yellow-400 py-1 text-center text-[10px] font-extrabold leading-none tracking-wide text-black shadow-[0_2px_10px_rgba(255,215,0,0.45)] ring-1 ring-yellow-500/70">
                        EQUIPPED
                      </div>
                    )}
                  </div>
                  <div className={`${orbitronClass} mt-0.5 text-center text-[11px] text-white`}>{c.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Modal via portal (fits iPad, not clipped) ===== */}
      {modalRoot && createPortal(
        <AnimatePresence>
          {active && (
            <motion.div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
              style={{
                paddingTop: "max(12px, env(safe-area-inset-top))",
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                paddingLeft: "max(12px, env(safe-area-inset-left))",
                paddingRight: "max(12px, env(safe-area-inset-right))",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActive(null)}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="relative w-[min(98vw,920px)] overflow-auto rounded-2xl border border-white/10 bg-gradient-to-br from-black/88 to-gray-900/88 backdrop-blur-xl p-5 sm:p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
                style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100 - 32px)" }}
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                role="dialog" aria-modal="true" aria-label={`${active.name} details`}
              >
                <button
                  onClick={() => setActive(null)}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                  aria-label="Close"
                >✕</button>

                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  {/* Big card — scales using vw and dvh so it fits iPad portrait */}
                  <div className={`rounded-2xl bg-gradient-to-br ${RARITY[active.rarity]?.ring || RARITY.common.ring} p-[3px] shrink-0`}>
                    <div
                      className={`flex items-center justify-center rounded-[16px] bg-black/90 ${RARITY[active.rarity]?.glow || ""}`}
                      style={{
                        width:  "clamp(220px, min(28vw, 40dvh), 340px)",
                        height: "clamp(320px, min(42vw, 60dvh), 480px)",
                      }}
                    >
                      <img
                        src={active.image_url}
                        alt={active.name}
                        className="object-contain"
                        style={{
                          width:  "clamp(190px, min(24vw, 34dvh), 306px)",
                          height: "clamp(280px, min(36vw, 50dvh), 440px)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Info + actions */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`${orbitronClass} text-2xl sm:text-3xl leading-tight`}>
                      {active.name}
                      <span className="ml-3 align-middle rounded bg-white/10 px-2 py-1 text-xs uppercase">{active.rarity}</span>
                    </h3>

                    <p className="mt-3 text-sm sm:text-base text-white/85">
                      Collectible card. Equip to boost your Daily Challenge bonus.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {!active.is_equipped ? (
                        <button
                          disabled={loading}
                          onClick={() => equipCard(active.user_card_id)}
                          className="rounded-lg bg-yellow-400 px-5 py-2.5 text-black font-semibold shadow-[0_0_14px_#FFD700] hover:brightness-95 disabled:opacity-60"
                        >
                          {loading ? "Equipping…" : "Equip"}
                        </button>
                      ) : (
                        <span className="rounded-lg bg-emerald-500/90 px-5 py-2.5 text-black font-semibold">Equipped</span>
                      )}
                      <button
                        className="rounded-lg bg-white/10 px-5 py-2.5 font-semibold text-white hover:bg-white/20"
                        onClick={() => setActive(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        modalRoot
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
