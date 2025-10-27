// lobbycomponents/LeftColumnCards.jsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { sessionData } from "../lib/sessionData";



// Slightly larger typography + better wrapping inside every tile
const CARD_BASE = "rounded-xl bg-black/70 text-white p-7 md:p-8 border border-white/12 break-words whitespace-normal hyphens-auto overflow-hidden leading-relaxed text-[17px] md:text-[18px] mb-6";

export default function LeftColumnCards({
  orbitronClass = "",
  player_id,
  playerId,
  }) {
  // Resolve player id
  const propPid = Number(player_id ?? playerId);
  const [pid, setPid] = useState(Number.isFinite(propPid) ? propPid : null);
  const [authChecked, setAuthChecked] = useState(false);

  const [player, setPlayer] = useState(null);      // { id, name, points }
  const [equipped, setEquipped] = useState(null);  // { name, rarity, image_url }

  useEffect(() => { if (Number.isFinite(propPid)) setPid(propPid); }, [propPid]);

  // Derive pid from auth if not provided
  useEffect(() => {
    (async () => {
      if (pid) { setAuthChecked(true); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthChecked(true); return; }
      const { data } = await supabase
        .from("players")
        .select("id,name,points")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (data?.id) { setPid(data.id); setPlayer(data); }
      setAuthChecked(true);
    })();
  }, [pid]);

  const hasPid = Number.isFinite(pid);

  const loadPlayer = useCallback(async () => {
    if (!hasPid) return;
    const { data } = await supabase
      .from("players")
      .select("id,name,points")
      .eq("id", pid)
      .maybeSingle();
    setPlayer(data || null);
  }, [hasPid, pid]);

  const loadEquipped = useCallback(async () => {
    if (!hasPid) return;
    const { data } = await supabase
      .from("user_cards")
      .select("id,is_equipped,cards:card_id(name,rarity,image_url)")
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

  // React to card changes elsewhere
  useEffect(() => {
    const onUpdate = () => { if (hasPid) { loadEquipped(); loadPlayer(); } };
    window.addEventListener("cards:updated", onUpdate);
    return () => window.removeEventListener("cards:updated", onUpdate);
  }, [hasPid, loadEquipped, loadPlayer]);

  // Initial fetch
  useEffect(() => {
    if (!hasPid) return;
    (async () => { await Promise.all([loadPlayer(), loadEquipped()]); })();
  }, [hasPid, loadPlayer, loadEquipped]);

  // Next Skills (from your sessionData)
  const nextSkills = useMemo(() => {
    const pts = Number(player?.points || 0);
    const all = Object.entries(sessionData).map(([key, s]) => ({
      key, title: s?.title || key, unlockXP: Number(s?.unlockXP || 0),
    }));
    const locked = all
      .filter((i) => i.unlockXP > pts)
      .sort((a, b) => a.unlockXP - b.unlockXP);
    return locked.slice(0, 2);
  }, [player?.points]);

  return (
    <div
      className="
        grid gap-10 grid-cols-1
        items-start
        [&>*]:min-w-0
      "
    >
      {/* RIGHT lane: stacked cards */}
      <div className="flex flex-col gap-12 order-2 order-2 md:order-none min-w-0">
        {/* Daily Skill Challenge */}
        <motion.div
          className={`${CARD_BASE} shadow-[0_0_14px_rgba(157,78,221,0.45)] border-purple-500/70`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.03 }}
        >
          <h3 className={`${orbitronClass} mb-1 text-[18px] md:text-[19px] drop-shadow-[0_0_6px_#9d4edd]`}>
            DAILY SKILL CHALLENGE
          </h3>
          <p className="text-[15px] md:text-[16px] text-gray-300">
            Complete today’s drill for base XP + equipped-card bonus.
          </p>
          <Link
            href="/skill-session/daily-player"
            className={`${orbitronClass} mt-3 inline-flex items-center justify-center rounded-lg bg-purple-500 px-5 py-2.5 text-lg font-bold text-black hover:brightness-110 whitespace-normal break-words w-full sm:w-auto`}
          >
            START CHALLENGE
          </Link>
        </motion.div>

        {/* Equipment */}
        <motion.div
          className={`${CARD_BASE} shadow-[0_0_16px_rgba(0,246,255,0.4)] border-blue-400/70`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.06 }}
        >
          <h3 className={`${orbitronClass} mb-2 text-[18px] md:text-[19px] drop-shadow-[0_0_6px_#00f6ff]`}>
            EQUIPMENT
          </h3>

          {!hasPid && authChecked ? (
            <div className="text-[15px] md:text-[16px] text-white/70">
              Sign in or pass <code>player_id</code> to view equipment.
            </div>
          ) : (
            <div className="flex items-center gap-4 min-w-0">
              <div className="rounded-xl bg-gradient-to-br from-yellow-300 to-orange-500 p-[2px]">
                <div className="flex h-32 w-24 items-center justify-center rounded-[12px] bg-black/85">
                  <img
                    src={equipped?.image_url || "/player-cards/a_iniesta_epic.png"}
                    alt={equipped?.name || "Equipped card"}
                    className="h-28 w-20 object-contain"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`${orbitronClass} text-[15px] md:text-[16px]`}>
                  Equipped: <span className="text-yellow-300">{equipped?.name || "None"}</span>
                  {equipped?.rarity ? ` (${equipped.rarity})` : ""}
                </div>
                <div className="text-[14px] text-white/70">
                  Manage and equip cards on your Player Dashboard.
                </div>
                <Link
                  href="/player-dashboard"
                  className="mt-2 inline-block rounded-md bg-white/10 px-3 py-1.5 text-[15px] md:text-[16px] hover:bg-white/20 whitespace-normal break-words"
                >
                  Open Collectables
                </Link>
              </div>
            </div>
          )}
        </motion.div>

        {/* Next Skills */}
        <motion.div
          className={`${CARD_BASE} shadow-[0_0_15px_rgba(255,215,0,0.4)] border-yellow-400/70`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.09 }}
        >
          <h3 className={`${orbitronClass} mb-2 text-[18px] md:text-[19px] drop-shadow-[0_0_6px_#FFD700]`}>
            NEXT SKILLS
          </h3>

          {!hasPid && authChecked ? (
            <div className="text-[15px] md:text-[16px] text-white/70">
              Sign in or pass <code>player_id</code> to see your next unlocks.
            </div>
          ) : player ? (
            nextSkills.length ? (
              <div className="space-y-3">
                {nextSkills.map((s) => {
                  const pts = Number(player?.points || 0);
                  const need = Math.max(0, s.unlockXP - pts);
                  const pct = s.unlockXP > 0 ? Math.max(0, Math.min(100, Math.round((pts / s.unlockXP) * 100))) : 0;
                  return (
                    <div key={s.key} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-[16px]">
                        <div className="font-semibold text-white">{s.title}</div>
                        <div className="text-[14px] md:text-[15px] text-white/70">
                          Unlocks at <b>{s.unlockXP}</b> XP · <span className="text-blue-300">{need} to go</span>
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-2 bg-gradient-to-r from-sky-400 to-blue-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[15px] md:text-[16px] text-emerald-300">You’ve unlocked all current skills. 🎉</div>
            )
          ) : (
            <div className="text-[15px] md:text-[16px] text-white/70">Loading…</div>
          )}

          <div className="pt-3">
            <Link
              href="/skills"
              className="inline-block rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[15px] md:text-[16px] hover:bg-white/10 whitespace-normal break-words"
            >
              Browse Skills
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
