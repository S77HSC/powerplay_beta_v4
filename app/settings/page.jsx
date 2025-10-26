'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { supabase } from '../../lib/supabase';

// ===== Neon bar from the lobby =====
const NeonIconBar = dynamic(() => import('../../lobbycomponents/NeonIconBar'), { ssr: false });

// ===== helpers =====
const AVATAR_BUCKET =
  (process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars').replace(/^\/+|\/+$/g, '');

/**
 * Normalize whatever we have in DB to a bucket-relative storage key:
 * - Leave full URLs or absolute paths untouched (already usable as <img src>)
 * - Strip exactly one leading "<bucket>/" if present
 * - Also collapse accidental "avatars/avatars/" to a single "avatars/" before stripping
 */
const toStorageKey = (maybeKey) => {
  if (!maybeKey) return null;
  if (/^https?:\/\//i.test(maybeKey) || String(maybeKey).startsWith('/')) return String(maybeKey);

  let key = String(maybeKey).replace(/^\/+/, '');

  // collapse accidental double prefixes like "avatars/avatars/<uuid>/file"
  key = key.replace(new RegExp(`^${AVATAR_BUCKET}\\/(?:${AVATAR_BUCKET}\\/)+`, 'i'), `${AVATAR_BUCKET}/`);

  // strip exactly one leading "<bucket>/" if it exists
  key = key.replace(new RegExp(`^${AVATAR_BUCKET}\\/`, 'i'), '');

  return key; // bucket-relative (e.g., "<uuid>/file.png")
};

/**
 * Turn a DB value (key or URL) into a public URL suitable for <img src>.
 * Accepts: full URL, absolute path, or bucket-relative key.
 */
const toPublicUrlFromKey = (key) => {
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || String(key).startsWith('/')) return String(key);

  const normalized = toStorageKey(key); // now bucket-relative
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(normalized);
  return data?.publicUrl || null;
};

const POSITIONS = ['ST', 'CF', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'LB', 'RB', 'CB', 'GK'];

export default function SettingsPage() {
  // parallax for background sheen
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const x = useSpring(mvX, { stiffness: 35, damping: 18 });
  const y = useSpring(mvY, { stiffness: 35, damping: 18 });
  const onMouseMove = useCallback(
    (e) => {
      mvX.set((e.clientX / window.innerWidth - 0.5) * 14);
      mvY.set((e.clientY / window.innerHeight - 0.5) * 8);
    },
    [mvX, mvY]
  );

  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [team, setTeam] = useState('');
  const [position, setPosition] = useState('ST');
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // fullscreen (same behavior as lobby)
  const [canFs, setCanFs] = useState(false);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const isPWA =
      (typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)')?.matches ||
          window.navigator?.standalone === true)) ||
      false;
    const supported = !!document.fullscreenEnabled && !isPWA;
    setCanFs(supported);
    setIsFs(!!document.fullscreenElement);
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
    } catch {}
  };
  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch {}
  };

  // Build full, localized country list
  const countryOptions = useMemo(() => {
    try {
      const hasIntlRegions = typeof Intl.supportedValuesOf === 'function';
      const regionCodes = hasIntlRegions
        ? Intl.supportedValuesOf('region').filter((c) => /^[A-Z]{2}$/.test(c))
        : ['US', 'GB', 'DE', 'ES', 'NO', 'FR', 'IT', 'NL', 'SE', 'CA', 'AU', 'BR', 'AR', 'JP', 'KR'];
      const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
      const dn = new Intl.DisplayNames([locale], { type: 'region' });

      return regionCodes
        .map((code) => ({ code, name: dn.of(code) || code }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
        { code: 'DE', name: 'Germany' },
        { code: 'ES', name: 'Spain' },
        { code: 'NO', name: 'Norway' },
      ];
    }
  }, []);

  // load user + player
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) {
        window.location.href = '/login';
        return;
      }
      setUser(u);

      const { data: p } = await supabase
        .from('players')
        .select('*')
        .eq('auth_id', u.id)
        .maybeSingle();

      if (!p) return;

      setPlayer(p);
      setName(p?.name || '');
      setCountry(String(p?.country || '').toUpperCase());
      setTeam(p?.team || '');
      const pos = p?.equipped_items?.card?.position || 'ST';
      setPosition(String(pos).toUpperCase());
    })();
  }, []);

  const handleSave = async () => {
    if (!user || !player) return;
    setSaving(true);

    try {
      // 1) Start from what's in DB and normalize to BUCKET-RELATIVE (no "avatars/" prefix)
      let nextKey = toStorageKey(player?.avatar_url) || null; // e.g., "<uuid>/file.png"
      let nextPublic = toPublicUrlFromKey(nextKey);

      // 2) Upload if a new file is selected
      if (selectedFile) {
        const fileName = `${Date.now()}-${selectedFile.name}`.replace(/\s+/g, '_');
        // store *under the user's folder* inside the bucket, bucket-relative path:
        const storagePath = `${user.id}/${fileName}`;

        const { error: upErr } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: selectedFile.type || 'image/*',
          });
        if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);

        // ✅ Save bucket-relative key in DB
        nextKey = storagePath;
        nextPublic = toPublicUrlFromKey(nextKey);
      }

      // 3) Preserve equipped_items, only change position
      const eq = player.equipped_items || {};
      const nextEquipped = { ...eq, card: { ...(eq.card || {}), position } };

      // 4) Save to DB and return the updated row (ensures RLS passes)
      const { data: updated, error: updErr } = await supabase
        .from('players')
        .update({
          name,
          country,
          team,
          avatar_url: nextKey, // ✅ store bucket-relative key (consistent)
          equipped_items: nextEquipped,
        })
        .eq('id', player.id)
        .select('*')
        .single();

      if (updErr) throw new Error(`Save failed: ${updErr.message}`);

      // 5) Update local state so the UI reflects the new avatar immediately
      setPlayer(updated);
      if (nextPublic) {
        // show public URL locally for instant preview
        setPlayer((p) => ({
          ...(p || {}),
          avatar_url: nextPublic,
          equipped_items: nextEquipped,
          name,
          country,
          team,
        }));
      }

      alert('Saved!');
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Something went wrong saving your settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      onMouseMove={onMouseMove}
      className="relative min-h-[100dvh] w-screen overflow-hidden text-white"
      style={{ background: '#05080f' }}
    >
      {/* ===== Fortnite / Powerplay style background ===== */}
      {/* Layer 1: vibrant radial + angular gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -10%, #0b1530 0%, #091329 35%, #071021 60%, #060b18 100%)',
        }}
      />
      {/* Layer 2: optional texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-screen"
        style={{
          backgroundImage:
            "url('/images/powerplay-fortnite.jpg'), url('/images/futuristic-stadium.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(1.05) brightness(1.05)',
        }}
      />
      {/* Layer 3: animated light sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          x,
          y,
          background:
            'linear-gradient(120deg, rgba(0,180,255,0.0) 20%, rgba(0,180,255,0.05) 40%, rgba(255,255,255,0.08) 50%, rgba(0,180,255,0.05) 60%, rgba(0,180,255,0.0) 80%)',
          mixBlendMode: 'screen',
        }}
        animate={{ backgroundPositionX: ['-40%', '140%'] }}
        transition={{ duration: 16, ease: 'linear', repeat: Infinity }}
      />
      {/* Layer 4: faint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '64px 64px, 64px 64px',
          transform: 'skewY(-3deg)',
        }}
      />

      {/* ===== Top bar: Settings (left) • Neon (center) • News + Fullscreen (right) ===== */}
      <div className="relative z-20 grid grid-cols-[auto_1fr_auto] items-center bg-black/40 p-3 border-b border-white/10 gap-3">
        <div className="pl-1 flex items-center gap-3">
          <span className="text-2xl font-semibold tracking-wider font-[Orbitron]">Settings</span>
          <Link
            href="/lobby"
            className="rounded px-2 py-1 text-sm bg-white/10 border border-white/15 hover:bg-white/15"
            aria-label="Back to Lobby"
            prefetch
          >
            Lobby
          </Link>
        </div>

        <div className="justify-self-center">
          <NeonIconBar />
        </div>

        <div className="flex items-center justify-end gap-2 pr-1">
          <Link
            href="/live-news"
            aria-label="Open Live News"
            className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-yellow-400/20 hover:border-yellow-400/60 transition-colors shrink-0"
          >
            News
          </Link>
          {canFs && (
            <button
              onClick={isFs ? exitFullscreen : enterFullscreen}
              aria-label={isFs ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="rounded-full border border-white/30 bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/80 hover:border-white/50"
            >
              {isFs ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          )}
        </div>
      </div>

      {/* ===== Settings card ===== */}
      <div className="relative z-20 mx-auto mt-10 w-[min(720px,92vw)] rounded-2xl border border-white/10 bg-[#0b1019]/70 p-6 shadow-[0_0_40px_rgba(0,200,255,0.15)]">
        <h2 className="font-[Orbitron] text-xl tracking-wider mb-4">Player Profile</h2>

        <div className="grid grid-cols-1 gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-yellow-300 to-orange-500">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-black/70">
                <img
                  src={toPublicUrlFromKey(player?.avatar_url) || '/characters/striker_base.png'}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <label className="inline-block">
              <span className="block text-[11px] uppercase tracking-widest text-white/70 mb-1">
                Change Avatar
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block text-sm"
              />
              <p className="mt-1 text-xs text-white/50">JPG/PNG up to ~5&nbsp;MB recommended.</p>
            </label>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-1">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-1">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg bg-white !text-black [color-scheme:light] border border-white/10 px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="" className="text-black bg-white">
                Select a country
              </option>
              {countryOptions.map(({ code, name }) => (
                <option key={code} value={code} className="text-black bg-white">
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Position */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-1">
              Preferred Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-white !text-black [color-scheme:light] border border-white/10 px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p} className="text-black bg-white">
                  {p}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/60">
              Used to shape your card stats (e.g. ST favors SHO/PAC/PHY).
            </p>
          </div>

          {/* Team */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/70 mb-1">
              Team
            </label>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/lobby"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-yellow-400 text-black font-bold px-5 py-2 text-sm hover:brightness-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Background keyframes for the Fortnite vibe */}
      <style jsx global>{`
        @keyframes floatGlow {
          0% {
            opacity: 0.05;
            transform: translateY(0px);
          }
          50% {
            opacity: 0.12;
            transform: translateY(-8px);
          }
          100% {
            opacity: 0.05;
            transform: translateY(0px);
          }
        }
      `}</style>
    </main>
  );
}
