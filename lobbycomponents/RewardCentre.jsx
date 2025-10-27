// lobbycomponents/RewardCentre.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import RewardRevealModal from "./RewardRevealModal";

// 👇 add weekly between streak and free
const ORDER = ["streak", "weekly", "free"];
const POLL_MS = 60_000;

const getId = (c) => c?.card_id ?? c?.id ?? c?.cardId ?? null;

const fmt = (ms) => {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

async function hydrateWithImages(list) {
  const arr = Array.isArray(list) ? list : [];
  const ids = arr.map(getId).filter(Boolean);
  if (!ids.length) return arr.map((c) => ({ ...c, card_id: getId(c) }));

  const { data: metas, error } = await supabase
    .from("cards")
    .select("id, name, rarity, image_url")
    .in("id", ids);

  if (error || !metas) {
    return arr.map((c) => {
      const cid = getId(c);
      return { ...c, card_id: cid, image: `/player-cards/${cid}.png` };
    });
  }

  const byId = Object.fromEntries(metas.map((m) => [m.id, m]));
  return arr.map((c) => {
    const cid = getId(c);
    const m = byId[cid] || {};
    const url = (c.image ?? m.image_url) || `/player-cards/${cid}.png`;
    return {
      ...c,
      card_id: cid,
      name: c.name ?? m.name ?? `Card #${cid}`,
      rarity: c.rarity ?? m.rarity ?? null,
      image: url.startsWith("/") ? url : `/${url}`,
    };
  });
}

export default function RewardCentre({ player_id, user_id, playerId }) {
  const pid = Number(player_id ?? playerId ?? user_id);
  const canUse = useMemo(() => Number.isFinite(pid) && pid > 0, [pid]);

  const [queue, setQueue] = useState([]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [reveal, setReveal] = useState({ open: false, title: "", cards: [], dust: 0 });
  const [nextFreePickAt, setNextFreePickAt] = useState(null);
  const [countdown, setCountdown] = useState("…");

  const checkingRef = useRef(false);
  const hasInitRef = useRef(false);

  const check = useCallback(async () => {
    if (!canUse) return;
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const wants = [];

      // streak eligibility (existing)
      try {
        const { data } = await supabase.rpc("fn_reward_eligibility_v4", { p_player: pid });
        const elig = Array.isArray(data) ? data?.[0] : data;
        if ((elig?.streak_days || 0) >= 3) wants.push("streak");
      } catch {}

      // weekly: we optimistically show it; server enforces once-per-week
      wants.push("weekly");

      // free pick readiness (existing)
      try {
        const { data: prog } = await supabase
          .from("user_progress")
          .select("next_free_pick_at")
          .eq("player_id", pid)
          .maybeSingle();

        setNextFreePickAt(prog?.next_free_pick_at || null);
        const freeReady = !prog?.next_free_pick_at || new Date(prog.next_free_pick_at) <= new Date();
        if (freeReady) wants.push("free");
      } catch {}

      setQueue(ORDER.filter((k) => wants.includes(k)));
    } finally {
      checkingRef.current = false;
    }
  }, [canUse, pid]);

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [check]);

  useEffect(() => {
    if (!nextFreePickAt) { setCountdown("Ready"); return; }
    const update = () => setCountdown(fmt(new Date(nextFreePickAt).getTime() - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [nextFreePickAt]);

  async function claim(kind) {
    if (!canUse || busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;

      if (kind === "streak") {
        const { data, error } = await supabase.functions.invoke("claim-streak", {
          body: { user_id: uid, player_id: pid },
        });
        if (error || !data?.ok || data?.alreadyClaimed) {
          setQueue((q) => q.filter((k) => k !== "streak"));
          return;
        }
        const cards = data.cards || (data.card ? [data.card] : []);
        const hydrated = await hydrateWithImages(cards);
        setReveal({ open: true, title: "3-Day Streak Reward", cards: hydrated, dust: data.dustAwarded || 0 });
        setPromptOpen(false);
      }

      if (kind === "weekly") {
        const { data, error } = await supabase.functions.invoke("award-weekly", {
          body: { user_id: uid, player_id: pid },
        });
        if (error) {
          setQueue((q) => q.filter((k) => k !== "weekly"));
          return;
        }

        // OPTIONAL: if your function returns a trophy object, you could surface it here.
        // const trophy = data?.trophy; // e.g. { code:"player_week", week_start:"2025-10-20", metrics:{...} }

        const cards = data?.cards || [];
        if (cards.length === 0) {
          // graceful: trophy recorded but no new card; no modal
          setQueue((q) => q.filter((k) => k !== "weekly"));
          return;
        }

        const hydrated = await hydrateWithImages(cards);
        setReveal({ open: true, title: "Weekly Reward", cards: hydrated, dust: 0 });
        setPromptOpen(false);
        setQueue((q) => q.filter((k) => k !== "weekly"));
      }

      if (kind === "free") {
        const { data, error } = await supabase.functions.invoke("free-pick", {
          body: { user_id: uid, player_id: pid },
        });
        if (error) return;
        const cards = data?.cards || [];
        if (cards.length === 0) {
          setQueue((q) => q.filter((k) => k !== "free"));
          return;
        }
        const hydrated = await hydrateWithImages(cards);
        setReveal({ open: true, title: "Free Pick", cards: hydrated, dust: data?.dustAwarded || 0 });
        if (data?.nextFreePickAt) setNextFreePickAt(data.nextFreePickAt);
        window.dispatchEvent(new Event("cards:updated"));
        setPromptOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function onCloseReveal() {
    setReveal({ open: false, title: "", cards: [], dust: 0 });
  }

  const rewardsAvailable = queue.length > 0 && !reveal.open;

  return (
    <>
      {/* Floating button */}
      <div
        className={`fixed bottom-4 right-4 z-[94] transition-opacity duration-150 ${
          rewardsAvailable ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => setPromptOpen(true)}
          className="rounded-full bg-yellow-400 text-black px-4 py-2 shadow-lg font-semibold"
        >
          Rewards ({queue.length})
        </button>
      </div>

      {/* Prompt (visibility toggled) */}
      <div
        className={`fixed inset-0 z-[95] grid place-items-center transition-opacity duration-150 ${
          promptOpen && rewardsAvailable ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!promptOpen || !rewardsAvailable}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        <div className="relative w-[92vw] max-w-md rounded-2xl border border-white/15 bg-black/80 p-5 text-white shadow-xl">
          <div className="mb-2 text-lg font-semibold">Rewards available</div>

          <ul className="mb-3 space-y-2">
            {queue.map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className="text-base">
                  {k === "streak" ? "🔥" : k === "weekly" ? "🏆" : "🎁"}
                </span>
                <span>
                  {k === "streak" ? "3-Day streak reward" :
                   k === "weekly" ? "Weekly reward" :
                   "Free Pick available"}
                </span>
                {k === "free" && nextFreePickAt && new Date(nextFreePickAt) > new Date() && (
                  <span className="ml-auto text-xs opacity-80">in {countdown}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex justify-center gap-3">
            <button
              disabled={busy}
              onClick={() => { setPromptOpen(false); claim(queue[0]); }}
              className="rounded-full bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60"
            >
              {busy ? "Claiming…" : "Claim now"}
            </button>
            <button
              onClick={() => setPromptOpen(false)}
              className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <RewardRevealModal
        open={reveal.open}
        title={reveal.title}
        cards={reveal.cards}
        dust={reveal.dust}
        onClose={onCloseReveal}
      />
    </>
  );
}
