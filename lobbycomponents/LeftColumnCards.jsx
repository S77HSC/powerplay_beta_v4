// lobbycomponents/LeftColumnCards.jsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { sessionData } from "../lib/sessionData";

const PLAYER_DASH_PATH = "/player-dashboard";

/* ---------- helpers ---------- */
const fmtCountdown = (targetISO) => {
  if (!targetISO) return "—";
  const diff = new Date(targetISO).getTime() - Date.now();
  if (diff <= 0) return "Ready";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export default function LeftColumnCards({ orbitronClass, player_id, playerId }) {
  /* ---------- resolve player id ---------- */
  const propPid = Number(player_id ?? playerId);
  const [pid, setPid] = useState(Number.isFinite(propPid) ? propPid : null);
  const [authChecked, setAuthChecked] = useState(false);

  const [player, setPlayer] = useState(null); // { id, name, points }

  // if parent later passes a pid, adopt it
  useEffect(() => {
    if (Number.isFinite(propPid)) setPid(propPid);
  }, [propPid]);

  // fallback: derive pid from auth -> players(auth_id)
  useEffect(() => {
    (async () => {
      if (pid) { setAuthChecked(true); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthChecked(true); return; }

      const { data } = await supabase
        .from("players")
        .select("id, name, points")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (data?.id) {
        setPid(data.id);
        setPlayer(data);
      }
      setAuthChecked(true);
    })();
  }, [pid]);

  const hasPid = Number.isFinite(pid);

  /* ---------- data loaders ---------- */
  const loadPlayer = useCallback(async () => {
    if (!hasPid) return;
    const { data } = await supabase
      .from("players")
      .select("id, name, points")
      .eq("id", pid)
      .maybeSingle();
    setPlayer(data || null);
  }, [hasPid, pid]);

  const [equipped, setEquipped] = useState(null); // { name, rarity, image_url }
  const loadEquipped = useCallback(async () => {
    if (!hasPid) return;
    const { data } = await supabase
      .from("user_cards")
      .select("id, is_equipped, cards:card_id(name, rarity, image_url)")
      .eq("player_id", pid)
      .eq("is_equipped", true)
      .limit(1)
      .maybeSingle();

    setEquipped(
      data
        ? {
            user_card_id: data.id,
            name: data.cards?.name || "Card",
            rarity: data.cards?.rarity || "common",
            image_url: data.cards?.image_url || "/player-cards/a_iniesta_epic.png",
          }
        : null
    );
  }, [hasPid, pid]);

  // listen for card updates from other panels
  useEffect(() => {
    const onUpdate = () => { if (hasPid) { loadEquipped(); loadPlayer(); } };
    window.addEventListener("cards:updated", onUpdate);
    return () => window.removeEventListener("cards:updated", onUpdate);
  }, [hasPid, loadEquipped, loadPlayer]);

  /* ---------- initial load ---------- */
  useEffect(() => {
    if (!hasPid) return;
    (async () => {
      await Promise.all([loadPlayer(), loadEquipped()]);
    })();
  }, [hasPid, loadPlayer, loadEquipped]);

  /* ---------- next skills ---------- */
  const nextSkills = useMemo(() => {
    const pts = Number(player?.points || 0);
    const all = Object.entries(sessionData).map(([key, s]) => ({
      key,
      title: s?.title || key,
      unlockXP: Number(s?.unlockXP || 0),
    }));
    const locked = all.filter((i) => i.unlockXP > pts);
    locked.sort((a, b) => a.unlockXP - b.unlockXP);
    return locked.slice(0, 2);
  }, [player?.points]);

  /* ---------- UI ---------- */
  const cardBase = "rounded-xl bg-black/70 text-white w-80 p-6";

  return (
    <div className="flex w-fit flex-col gap-6">
      {/* 1) Daily Skill Challenge */}
      <motion.div
        className={`${cardBase} border border-purple-500/70 shadow-[0_0_14px_rgba(157,78,221,0.5)]`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h3 className={`${orbitronClass} mb-1 text-base drop-shadow-[0_0_6px_#9d4edd]`}>
          DAILY SKILL CHALLENGE
        </h3>
        <p className="text-xs text-gray-300">
          Complete today’s drill for base XP + equipped-card bonus.
        </p>
        <Link
          href="/skill-session/daily-player"
          className={`${orbitronClass} mt-3 inline-flex items-center justify-center rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-black shadow-[0_0_10px_#9d4edd] hover:brightness-110`}
        >
          START CHALLENGE
        </Link>
      </motion.div>

      {/* 2) EQUIPMENT — keep this visible */}
      <motion.div
        className={`${cardBase} border border-blue-400/70 shadow-[0_0_16px_rgba(0,246,255,0.45)]`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <h3 className={`${orbitronClass} mb-2 text-base drop-shadow-[0_0_6px_#00f6ff]`}>
          EQUIPMENT
        </h3>

        {!hasPid && authChecked ? (
          <div className="text-xs text-white/70">
            Sign in or pass <code>player_id</code> to view equipment.
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-yellow-300 to-orange-500 p-[2px]">
              <div className="flex h-28 w-20 items-center justify-center rounded-[10px] bg-black/85">
                <img
                  src={equipped?.image_url || "/player-cards/a_iniesta_epic.png"}
                  alt={equipped?.name || "Equipped card"}
                  className="h-24 w-16 object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className={`${orbitronClass} text-sm`}>
                Equipped:{" "}
                <span className="text-yellow-300">{equipped?.name || "None"}</span>
                {equipped?.rarity ? ` (${equipped.rarity})` : ""}
              </div>
              <div className="text-xs text-white/70">
                Manage and equip cards on your Player Dashboard.
              </div>

              {/* Go to Player Dashboard */}
              <Link
                href={PLAYER_DASH_PATH}
                className="mt-2 inline-block rounded-md bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                Open Collectables
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      {/* 3) NEXT SKILLS */}
      <motion.div
        className={`${cardBase} border border-yellow-400/70 shadow-[0_0_15px_rgba(255,215,0,0.45)]`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <h3 className={`${orbitronClass} mb-2 text-base drop-shadow-[0_0_6px_#FFD700]`}>
          NEXT SKILLS
        </h3>

        {!hasPid && authChecked ? (
          <div className="text-xs text-white/70">
            Sign in or pass <code>player_id</code> to see your next unlocks.
          </div>
        ) : player ? (
          nextSkills.length ? (
            <div className="space-y-3">
              {nextSkills.map((s) => {
                const pts = Number(player?.points || 0);
                const need = Math.max(0, s.unlockXP - pts);
                const pct =
                  s.unlockXP > 0
                    ? Math.max(0, Math.min(100, Math.round((pts / s.unlockXP) * 100)))
                    : 0;
                return (
                  <div key={s.key} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-white">{s.title}</div>
                      <div className="text-[11px] text-white/70">
                        Unlocks at <b>{s.unlockXP}</b> XP ·{" "}
                        <span className="text-blue-300">{need} to go</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-1.5 bg-gradient-to-r from-sky-400 to-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-emerald-300">You’ve unlocked all current skills. 🎉</div>
          )
        ) : (
          <div className="text-xs text-white/70">Loading…</div>
        )}

        <div className="pt-3">
          {/* 🔁 Changed from /skill-session to /skills */}
          <Link
            href="/skills"
            className="inline-block rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] hover:bg-white/10"
          >
            Browse Skills
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
