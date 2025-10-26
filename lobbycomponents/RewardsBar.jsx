"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import RewardRevealModal from "./RewardRevealModal";
import { supabase } from "../lib/supabase"; // <- align with the rest of your app

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// tiny helper so every invoke carries headers
const fn = (name, body) =>
  supabase.functions.invoke(name, {
    body,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
  });

function fmt(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

export default function RewardsBar({ playerId, className = "", onReveal }) {
  const [busy, setBusy] = useState({ weekly: false, streak: false, free: false });
  const [msg, setMsg] = useState(null);
  const [nextFreePickAt, setNextFreePickAt] = useState(null);
  const [countdown, setCountdown] = useState("…");
  const [reveal, setReveal] = useState({ open: false, title: "", cards: [], dust: 0 });

  const canUsePlayer = useMemo(() => Number.isFinite(Number(playerId)), [playerId]);

  // get auth UUID for weekly/streak
  const [authId, setAuthId] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthId(data?.user?.id || null);
    })();
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!canUsePlayer) return;
    // FIX: user_progress is keyed by player_id (not user_id)
    const { data } = await supabase
      .from("user_progress")
      .select("next_free_pick_at")
      .eq("player_id", playerId)
      .maybeSingle();
    setNextFreePickAt(data?.next_free_pick_at || null);
  }, [canUsePlayer, playerId]);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!nextFreePickAt) { setCountdown("Ready"); return; }
      setCountdown(fmt(new Date(nextFreePickAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [nextFreePickAt]);

  const openReveal = ({ title, cards, dust }) => {
    if (onReveal) onReveal(cards, dust, { title });
    else setReveal({ open: true, title, cards, dust });
  };

  const claimWeekly = useCallback(async () => {
    try {
      if (!authId) return setMsg("Sign in to claim");
      setBusy(b => ({ ...b, weekly: true })); setMsg(null);
      // FIX: weekly expects user_id (UUID) + headers
      const { data, error } = await fn("claim-weekly", { user_id: authId });
      if (error) throw error;
      if (data?.alreadyClaimed) return setMsg("Already claimed this week.");
      if (!data?.ok) return setMsg(data?.reason || "Not eligible yet");
      openReveal({ title: "Weekly Reward", cards: data.cards || [], dust: data.dustAwarded || 0 });
      setMsg(`Claimed ${String(data.tier || "weekly").toUpperCase()} reward`);
    } catch (e) { setMsg(e?.message || "Claim failed"); }
    finally { setBusy(b => ({ ...b, weekly: false })); }
  }, [authId]);

  const claimStreak = useCallback(async () => {
    try {
      if (!authId) return setMsg("Sign in to claim");
      setBusy(b => ({ ...b, streak: true })); setMsg(null);
      // FIX: streak expects user_id (UUID) + headers
      const { data, error } = await fn("claim-streak", { user_id: authId });
      if (error) throw error;
      if (data?.alreadyClaimed) return setMsg("Already claimed 3-day streak.");
      if (!data?.ok) return setMsg(data?.reason || "Streak not ready");
      openReveal({ title: "3-Day Streak Reward", cards: data.cards || [], dust: data.dustAwarded || 0 });
      setMsg("Streak reward claimed!");
    } catch (e) { setMsg(e?.message || "Claim failed"); }
    finally { setBusy(b => ({ ...b, streak: false })); }
  }, [authId]);

  const claimFreePick = useCallback(async () => {
    try {
      if (!canUsePlayer) return setMsg("Sign in to claim");
      setBusy(b => ({ ...b, free: true })); setMsg(null);
      // Free pick expects player_id (BIGINT) + headers
      const { data, error } = await fn("free-pick", { player_id: playerId });
      if (error) { setMsg(error.message || "On cooldown"); await refreshProgress(); return; }
      const cards = data?.cards || (data?.card ? [data.card] : []);
      openReveal({ title: "Free Pick", cards, dust: data?.dustAwarded || 0 });
      if (data?.nextFreePickAt) setNextFreePickAt(data.nextFreePickAt);
      setMsg("Free pick claimed!");
    } catch (e) { setMsg(e?.message || "Claim failed"); }
    finally { setBusy(b => ({ ...b, free: false })); }
  }, [canUsePlayer, playerId, refreshProgress]);

  const disabledFree = useMemo(
    () => nextFreePickAt && new Date(nextFreePickAt) > new Date(),
    [nextFreePickAt]
  );

  return (
    <>
      <div className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 ${className}`}>
        <button onClick={claimFreePick} disabled={busy.free || disabledFree}
          className="w-full sm:w-auto rounded-full bg-fuchsia-400 px-3 sm:px-4 py-2 font-semibold text-black disabled:opacity-60 shadow-[0_8px_24px_rgba(217,70,239,0.35)] hover:brightness-95 transition">
          {busy.free ? "Picking…" : `🎁 Free Pick ${disabledFree ? `(${countdown})` : ""}`}
        </button>
        <button onClick={claimStreak} disabled={busy.streak}
          className="w-full sm:w-auto rounded-full bg-emerald-400 px-3 sm:px-4 py-2 font-semibold text-black disabled:opacity-60 shadow-[0_8px_24px_rgba(16,185,129,0.35)] hover:brightness-95 transition">
          {busy.streak ? "Claiming…" : "🔥 Claim 3-Day"}
        </button>
        <button onClick={claimWeekly} disabled={busy.weekly}
          className="w-full sm:w-auto rounded-full bg-yellow-400 px-3 sm:px-4 py-2 font-semibold text-black disabled:opacity-60 shadow-[0_8px_24px_rgba(251,191,36,0.35)] hover:brightness-95 transition">
          {busy.weekly ? "Claiming…" : "🏆 Claim Weekly"}
        </button>
        {msg && <span className="block w-full sm:w-auto text-center text-xs sm:text-sm text-white/85">{msg}</span>}
      </div>

      <RewardRevealModal
        open={reveal.open}
        title={reveal.title}
        cards={reveal.cards}
        dust={reveal.dust}
        onClose={() => setReveal({ open:false, title:"", cards:[], dust:0 })}
      />
    </>
  );
}
