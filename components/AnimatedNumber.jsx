// lobbycomponents/PlayerCardTile.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AnimatedNumber from '../components/AnimatedNumber';

const RARITY = {
  legendary: { ring: 'from-yellow-300 to-orange-500', glow: 'rgba(255,184,0,.38)' },
  epic:      { ring: 'from-fuchsia-400 to-purple-600', glow: 'rgba(192,64,255,.34)' },
  rare:      { ring: 'from-sky-400 to-blue-600',       glow: 'rgba(0,190,255,.34)' },
  common:    { ring: 'from-slate-300 to-slate-500',    glow: 'rgba(160,170,180,.28)' },
};

const STATUS = {
  Beginner:  'bg-slate-800/70 text-slate-100 ring-1 ring-white/15',
  'Semi-Pro':'bg-emerald-700/70 text-emerald-50 ring-1 ring-emerald-300/30',
  Pro:       'bg-sky-700/70 text-sky-50 ring-1 ring-sky-300/30',
  Master:    'bg-violet-700/70 text-violet-50 ring-1 ring-violet-300/30',
  Legend:    'bg-amber-700/80 text-amber-50 ring-1 ring-amber-300/35',
};

export default function PlayerCardTile({
  layout = 'panel',
  maxWidth = 340,
  dense = false,
  orbitronClass = '',
  userName,
  level,          // fallback only; we’ll prefer players.level
  rarity,
  avatarUrl,      // fallback only
  nationFlagUrl = '/flags/eng.png',
  clubBadgeUrl = '/clubs/powerplay.png',
  overall,
  position,
  stats,
  cardId: cardIdProp,
}) {
  if (layout !== 'panel') return null;

  const { user, player } = useAuth();

  // Live fields from players
  const [eiLive, setEiLive] = useState(null);
  const [playerStatus, setPlayerStatus] = useState(null);
  const [playerAvatarUrl, setPlayerAvatarUrl] = useState(null);
  const [playerLevel, setPlayerLevel] = useState(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from('players')
        .select('equipped_items, player_status, avatar_url, level')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (!error) {
        setEiLive(data?.equipped_items ?? null);
        setPlayerStatus(data?.player_status ?? null);
        setPlayerAvatarUrl(data?.avatar_url ?? null);
        setPlayerLevel(data?.level ?? null);
      }
    })();

    // realtime for equipped_items / status / avatar / level
    const ch = supabase
      .channel('realtime:players_equipped_status_avatar_level')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `auth_id=eq.${user.id}` },
        (payload) => {
          const row = payload?.new ?? {};
          if ('equipped_items' in row) setEiLive(row.equipped_items ?? null);
          if ('player_status' in row)  setPlayerStatus(row.player_status ?? null);
          if ('avatar_url' in row)     setPlayerAvatarUrl(row.avatar_url ?? null);
          if ('level' in row)          setPlayerLevel(row.level ?? null);
        }
      )
      .subscribe();

    return () => { alive = false; try { ch.unsubscribe(); } catch {} };
  }, [user?.id]);

  function parseEI(raw) {
    try { return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}); }
    catch { return {}; }
  }

  function resolveAvatarUrl(raw) {
    if (!raw) return null;
    if (raw.startsWith('http') || raw.startsWith('/')) return raw;
    const buckets = ['avatars', 'profile-avatars', 'players', 'public'];
    for (const b of buckets) {
      try {
        const { data } = supabase.storage.from(b).getPublicUrl(raw);
        if (data?.publicUrl) return data.publicUrl;
      } catch {}
    }
    return raw;
  }

  const ei     = useMemo(() => parseEI(eiLive ?? player?.equipped_items), [eiLive, player?.equipped_items]);
  const eiCard = ei?.card || {};

  const resolvedAvatar =
    resolveAvatarUrl(playerAvatarUrl) ||
    eiCard?.avatarUrl ||
    avatarUrl ||
    '/characters/striker_base.png';

  // prefer DB player level → then context → then card level → fallback 1
  const levelToShow =
    (typeof playerLevel === 'number' ? playerLevel : null) ??
    (typeof player?.level === 'number' ? player.level : null) ??
    eiCard?.level ??
    level ??
    1;

  const ui = {
    userName : player?.name ?? player?.display_name ?? userName ?? 'Player',
    rarity   : eiCard?.rarity ?? rarity ?? 'legendary',   // controls ring/glow + label text
    overall  : eiCard?.overall ?? overall ?? 60,
    position : eiCard?.position ?? position ?? 'LW',
    avatarUrl: resolvedAvatar,
    stats: {
      pac: eiCard?.stats?.pac ?? stats?.pac ?? 0,
      sho: eiCard?.stats?.sho ?? stats?.sho ?? 0,
      pas: eiCard?.stats?.pas ?? stats?.pas ?? 0,
      dri: eiCard?.stats?.dri ?? stats?.dri ?? 0,
      def: eiCard?.stats?.def ?? stats?.def ?? 0,
      phy: eiCard?.stats?.phy ?? stats?.phy ?? 0,
    },
    id: eiCard?.id ?? cardIdProp ?? 'default_card',
    playerStatus: playerStatus ?? 'Beginner',
    level: levelToShow,
  };

  const theme = RARITY[ui.rarity] || RARITY.common;
  const statusClasses = STATUS[ui.playerStatus] ?? STATUS.Beginner;

  // Equipped pointer
  const equippedCardId = ei?.equipped_card_id ?? null;
  const isEquipped = Boolean(ui.id && equippedCardId && String(equippedCardId) === String(ui.id));

  // Brand-new users: animate to a floor of 15
  const allVals = [ui.stats.pac, ui.stats.sho, ui.stats.pas, ui.stats.dri, ui.stats.def, ui.stats.phy];
  const isNewUser = allVals.every(v => !v || Number(v) === 0);
  const floorVal = 15;

  async function onEquip() {
    if (!user?.id || !ui.id || isEquipped) return;
    try {
      setSaving(true);
      const next = { ...(ei || {}), equipped_card_id: ui.id };
      const { error: upErr } = await supabase
        .from('players')
        .update({ equipped_items: next })
        .eq('auth_id', user.id);
      if (!upErr) setEiLive(next);

      // sync selected card meta into players.equipped_items.card
      const { error: rpcErr } = await supabase.rpc('pp_sync_equipped_card_into_player');
      if (rpcErr) console.warn('pp_sync_equipped_card_into_player failed:', rpcErr);

      // refetch after sync
      const { data } = await supabase
        .from('players')
        .select('equipped_items, player_status, avatar_url, level')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (data) {
        setEiLive(data.equipped_items ?? null);
        setPlayerStatus(data.player_status ?? null);
        setPlayerAvatarUrl(data.avatar_url ?? null);
        setPlayerLevel(data.level ?? null);
      }
    } catch (e) {
      console.error('Equip failed', e);
    } finally {
      setSaving(false);
    }
  }

  // density knobs
  const pad = dense ? 'p-4' : 'p-5';
  const nameSize = dense ? 'text-xl' : 'text-2xl';
  const avatarSize = dense ? 78 : 86;
  const topOVR = dense ? 'text-3xl' : 'text-4xl';
  const posSize = dense ? 'text-lg' : 'text-xl';
  const statVal = dense ? 'text-[18px]' : 'text-[20px]';
  const statLabel = dense ? 'text-[10px]' : 'text-[11px]';
  const btnPad = dense ? 'py-2' : 'py-2.5';

  return (
    <div
      className={`relative rounded-2xl border border-white/10 
                  bg-gradient-to-b from-[#0b1019]/85 to-[#0b1019]/60 
                  backdrop-blur-sm ${pad} text-white overflow-hidden`}
      style={{ width: maxWidth, maxWidth, boxShadow: `0 0 40px ${theme.glow}` }}
    >
      {/* Static outer aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% -10%, rgba(255,255,255,.10), rgba(255,255,255,0) 60%)' }}
      />

      {/* Shine sweep (no fade loop) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-4 -left-24 -right-24 rounded-2xl"
        style={{
          background: 'linear-gradient(110deg, rgba(255,255,255,0) 45%, rgba(255,255,255,.28) 50%, rgba(255,255,255,0) 55%)',
          mixBlendMode: 'screen',
        }}
        initial={{ x: '-120%' }}
        animate={{ x: ['-120%', '120%'] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3.2, ease: 'easeOut' }}
      />

      {/* top bar */}
      <div className={`${dense ? 'mb-2' : 'mb-3'} relative z-[1] flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`${orbitronClass} ${topOVR} leading-none drop-shadow-[0_0_10px_rgba(255,255,255,.25)]`} title="Overall">
            <AnimatedNumber value={isNewUser ? Math.max(ui.overall ?? 0, floorVal) : Number(ui.overall) || 0} />
          </span>
          <div className="leading-tight">
            <div className={`${orbitronClass} text-xs opacity-80`}>Position</div>
            <div className={`${orbitronClass} -mt-0.5 ${posSize}`}>{ui.position}</div>
          </div>
        </div>

        {/* Player STATUS chip */}
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs uppercase tracking-wider ${statusClasses}`}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
          {ui.playerStatus}{isEquipped ? ' • Equipped' : ''}
        </span>
      </div>

      {/* avatar + meta */}
      <div className="relative z-[1] flex items-center gap-3">
        <div className={`relative rounded-full bg-gradient-to-br ${RARITY[ui.rarity]?.ring ?? RARITY.common.ring} p-[3px]`}>
          <div className="overflow-hidden rounded-full bg-black/70" style={{ width: avatarSize, height: avatarSize }}>
            <img
              src={encodeURI(ui.avatarUrl)}
              alt={ui.userName}
              className="h-full w-full object-cover"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div
            className="pointer-events-none absolute -inset-3 rounded-full"
            style={{ background: 'radial-gradient(55% 55% at 50% 50%, rgba(255,255,255,.22), rgba(255,255,255,0) 60%)', mixBlendMode: 'screen' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className={`${orbitronClass} ${nameSize} leading-tight truncate`}>{ui.userName}</div>
          {/* ↓ Player Level + card rarity */}
          <div className="text-xs text-white/70">Level {ui.level} • {ui.rarity}</div>
          <div className="mt-2 flex items-center gap-2">
            {nationFlagUrl && <img src={nationFlagUrl} alt="nation" className="h-5 w-7 rounded-sm object-cover opacity-90" />}
            {clubBadgeUrl && <img src={clubBadgeUrl} alt="club" className="h-6 w-6 object-contain opacity-90" />}
          </div>
        </div>
      </div>

      {/* six stats (animated) */}
      <div className={`${dense ? 'mt-3' : 'mt-4'} relative z-[1] grid grid-cols-3 gap-2`}>
        {[
          ['PAC', ui.stats.pac],
          ['SHO', ui.stats.sho],
          ['PAS', ui.stats.pas],
          ['DRI', ui.stats.dri],
          ['DEF', ui.stats.def],
          ['PHY', ui.stats.phy],
        ].map(([label, val]) => {
          const target = isNewUser ? floorVal : Math.max(0, Math.min(99, Number(val) || 0));
          return (
            <div key={label} className="rounded-xl bg-white/5 px-3 py-2 text-center border border-white/5">
              <div className={`${orbitronClass} ${statLabel} tracking-wider opacity-80`}>{label}</div>
              <div className={`${orbitronClass} ${statVal} leading-none`}>
                <AnimatedNumber value={target} />
              </div>
            </div>
          );
        })}
      </div>

      {/* actions */}
      <div className={`${dense ? 'mt-3' : 'mt-4'} relative z-[1] flex gap-2`}>
        <button
          onClick={onEquip}
          disabled={saving || isEquipped || !user?.id}
          className={`flex-1 rounded-xl bg-white text-black text-sm font-bold ${btnPad} hover:brightness-95 disabled:opacity-60`}
          title={!user?.id ? 'Sign in to equip' : isEquipped ? 'Already equipped' : 'Equip this card'}
        >
          {saving ? 'Equipping…' : isEquipped ? 'Equipped' : 'Equip'}
        </button>
      </div>
    </div>
  );
}
