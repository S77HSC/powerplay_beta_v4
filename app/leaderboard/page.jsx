'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LeaderboardPreviewCard from '../../components/LeaderboardPreviewCard';
import { motion } from 'framer-motion';
import NeonIconBar from '../../lobbycomponents/NeonIconBar';

// Tabs (no Skills)
const TABS = ['Points', 'Workouts', 'Time'];

// Continents for quick filtering
const CONTINENTS = [
  { key: 'ALL', label: '🌍 All' },
  { key: 'AF', label: '🌍 Africa' },
  { key: 'AS', label: '🌏 Asia' },
  { key: 'EU', label: '🌍 Europe' },
  { key: 'NA', label: '🌎 N. America' },
  { key: 'SA', label: '🌎 S. America' },
  { key: 'OC', label: '🌏 Oceania' },
];

// Continent mapping for ISO-2
const COUNTRY_TO_CONTINENT = {
  US: 'NA', CA: 'NA', MX: 'NA',
  BR: 'SA', AR: 'SA', CL: 'SA', CO: 'SA', PE: 'SA',
  GB: 'EU', IE: 'EU', FR: 'EU', DE: 'EU', IT: 'EU', ES: 'EU', PT: 'EU',
  NL: 'EU', BE: 'EU', PL: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU',
  CH: 'EU', AT: 'EU', CZ: 'EU', HU: 'EU', RO: 'EU', GR: 'EU',
  RU: 'EU', UA: 'EU',
  CN: 'AS', JP: 'AS', KR: 'AS', IN: 'AS', SG: 'AS', MY: 'AS', TH: 'AS',
  VN: 'AS', PH: 'AS', ID: 'AS', HK: 'AS', TW: 'AS',
  AU: 'OC', NZ: 'OC',
  ZA: 'AF', NG: 'AF', EG: 'AF', KE: 'AF', MA: 'AF', GH: 'AF', DZ: 'AF', ET: 'AF',
};

// Normalize country values coming from DB (aliases → ISO2)
const COUNTRY_ALIASES = {
  EN: 'GB', ENG: 'GB', UK: 'GB', ENGLAND: 'GB', 'UNITED KINGDOM': 'GB',
  SP: 'ES', SPAIN: 'ES',
  USA: 'US', 'UNITED STATES': 'US',
  ARGENTINA: 'AR', NORWAY: 'NO', GERMANY: 'DE',
};

function normalizeCountry(codeOrName) {
  if (!codeOrName) return '';
  const raw = String(codeOrName).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return COUNTRY_ALIASES[raw] || raw;
  return COUNTRY_ALIASES[raw] || raw; // if it's a name, try alias, else leave as-is
}

export default function LeaderboardPage() {
  const [active, setActive] = useState('Points');
  const [region, setRegion] = useState('ALL');
  const [query, setQuery] = useState('');

  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [currentAuthId, setCurrentAuthId] = useState(null); // NEW: track me

  const [pointsRows, setPointsRows] = useState([]);
  const [sessionRows, setSessionRows] = useState([]);
  const [timeRows, setTimeRows] = useState([]);
  
  // Friends filter state
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [friendAuthIds, setFriendAuthIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // Disable browser zoom (Ctrl/⌘ + scroll and Ctrl/⌘ + [+]/[-]/0) on this page only
  useEffect(() => {
    const onWheel = (e) => { if (e.ctrlKey) e.preventDefault(); };
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === '+' || k === '-' || k === '=' || k === '_' || k === '0') e.preventDefault();
      }
    };
    const onGesture = (e) => { e.preventDefault(); };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('gesturestart', onGesture, { passive: false });
    window.addEventListener('gesturechange', onGesture, { passive: false });
    window.addEventListener('gestureend', onGesture, { passive: false });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('gesturestart', onGesture);
      window.removeEventListener('gesturechange', onGesture);
      window.removeEventListener('gestureend', onGesture);
    };
  }, []);

  // IMPORTANT: let the body scroll normally (no global scroll lock)
  // We keep all scrolling inside the main content area using flexbox.

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrMsg('');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentAuthId(user.id); // NEW: include me later in friend set
          const { data: me } = await supabase
            .from('players')
            .select('id')
            .eq('auth_id', user.id)
            .single();
          if (me?.id) setCurrentPlayerId(me.id);
          // Fetch friends for current user (both directions)
          const { data: fr } = await supabase
            .from('friends')
            .select('user_id, friend_id, approved, status')
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
          const ids = [];
          (fr || []).forEach(r => {
            const ok = r?.status === 'accepted' || r?.approved === true || r?.approved === 'true';
            if (ok) ids.push(r.user_id === user.id ? r.friend_id : r.user_id);
          });
          setFriendAuthIds(ids);
        }

        const { data: pts, error: ptsErr } = await supabase
          .from('players')
          .select('id, auth_id, name, country, avatar_url, points, workouts_completed')
          .order('points', { ascending: false, nullsFirst: false })
          .order('workouts_completed', { ascending: false })
          .order('name', { ascending: true })
          .limit(200);
        if (ptsErr) throw ptsErr;
        setPointsRows(pts ?? []);

        const { data: wl } = await supabase
          .from('workout_player_stats')
          .select('player_id, name, country, avatar_url, sessions')
          .order('sessions', { ascending: false, nullsFirst: false })
          .order('name', { ascending: true })
          .limit(200);
        setSessionRows((wl ?? []).map(r => ({ ...r, id: r.player_id })));

        const { data: tl } = await supabase
          .from('workout_player_stats')
          .select('player_id, name, country, avatar_url, total_minutes')
          .order('total_minutes', { ascending: false, nullsFirst: false })
          .order('name', { ascending: true })
          .limit(200);
        setTimeRows((tl ?? []).map(r => ({ ...r, id: r.player_id })));
      } catch (e) {
        console.error(e);
        setErrMsg(e?.message || 'Failed to load leaderboards.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Map player_id -> auth_id (from points list) and friend set
  const playerIdToAuthId = useMemo(() => {
    const m = {};
    (pointsRows || []).forEach(p => { if (p?.id) m[p.id] = p.auth_id; });
    return m;
  }, [pointsRows]);

  // NEW: include me in the friend set so I appear in Friends view
  const friendSet = useMemo(() => {
    const s = new Set(friendAuthIds || []);
    if (currentAuthId) s.add(currentAuthId);
    return s;
  }, [friendAuthIds, currentAuthId]);

  // Filter by region + search + optional friends-only
  const filterByWorld = (rows) => rows.filter(r => {
    const iso = normalizeCountry(r.country);
    const continent = COUNTRY_TO_CONTINENT[iso] || '';
    const matchesRegion = region === 'ALL' || continent === region;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || (r.name?.toLowerCase() || '').includes(q);

    let matchesFriends = true;
    if (friendsOnly) {
      const auth = r.auth_id || playerIdToAuthId[r.id];
      matchesFriends = auth ? friendSet.has(auth) : false;
    }

    return matchesRegion && matchesQuery && matchesFriends;
  });

  const displayRows = useMemo(() => ({
    Points: filterByWorld(pointsRows),
    Workouts: filterByWorld(sessionRows),
    Time: filterByWorld(timeRows),
  }), [pointsRows, sessionRows, timeRows, region, query, friendsOnly, friendAuthIds, currentAuthId]); // include currentAuthId so view updates

  return (
    <main
      className="relative text-white bg-[#090b14] overflow-hidden flex flex-col"
      style={{ minHeight: '100dvh' }}
    >
      <WorldGridBackground />

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 py-6 md:py-10 flex-1 flex flex-col min-h-0">
        {/* HEADER ROW: Neon left, Title right with globe at end */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 md:mb-6"
        >
          {/* Make header a responsive grid so the left bar gets full-width while the title block stays compact */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4">
            {/* Left: app nav forced to a single horizontal row with horizontal scroll if needed */}
            <div className="min-w-0">
              <div className="one-row-bar no-scrollbar overflow-x-auto">
                <NeonIconBar current="leaderboard" size="sm" />
              </div>
            </div>

            {/* Right: title block aligned right, globe after text */}
            <div className="flex items-center gap-3 justify-end shrink-0">
              <div className="text-right">
                <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-[0.12em] text-cyan-300 drop-shadow-[0_0_10px_#00f0ff] leading-none">
                  World Leaderboard
                </h1>
                <p className="text-white/70 text-xs md:text-sm">
                  Compete across the globe. Filter by region and find your world rank.
                </p>
              </div>
              <GlobeBadge />
            </div>
          </div>
        </motion.header>

        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 md:mb-6">
          <div className="flex gap-2 flex-wrap">
            {TABS.map(tab => (
              <motion.button
                key={tab}
                whileHover={{ scale: 1.05 }}
                onClick={() => setActive(tab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold tracking-wide transition-all ${
                  active === tab
                    ? 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black shadow-[0_0_15px_rgba(0,255,255,0.6)]'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                }`}
              >
                {tab}
              </motion.button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            {/* Friends-only toggle */}
            <button
              onClick={() => setFriendsOnly(v => !v)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold tracking-wide transition-all ${
                friendsOnly
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_15px_rgba(0,255,200,0.45)]'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}
              title="Show only your friends"
            >
              <span className="mr-1" aria-hidden>👥</span> Friends
            </button>
            {/* Region dropdown (styled) */}
            <div className="relative inline-block">
              {/* left globe */}
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-cyan-300/90">
                <span aria-hidden>🌐</span>
              </div>

              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="appearance-none bg-white/10 backdrop-blur border border-white/20 text-white rounded-2xl pl-10 pr-10 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-300 transition"
              >
                {CONTINENTS.map((c) => (
                  <option key={c.key} value={c.key} className="bg-[#121422] text-white">
                    {c.label}
                  </option>
                ))}
              </select>

              {/* right chevron */}
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Search input (styled to match) */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player…"
              className="bg-white/10 backdrop-blur border border-white/20 text-white rounded-2xl px-3 py-2 text-sm placeholder-white/50 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-300 transition"
            />
          </div>
        </div>

        {/* BODY: fills the remaining viewport height; only this area scrolls */}
        <div className="relative flex-1 min-h-0">
          {loading ? (
            <div className="grid place-items-center h-full text-white/70">Loading…</div>
          ) : errMsg ? (
            <div className="grid place-items-center h-full text-rose-400">{errMsg}</div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full"
            >
              {active === 'Points' && (
                <WorldSection title="🏆 XP (Points) — Global Rank" accent="cyan">
                  <WorldLeaderboard
                    players={displayRows.Points}
                    highlightId={currentPlayerId}
                    valueKey="points"
                    label="XP"
                  />
                </WorldSection>
              )}

              {active === 'Workouts' && (
                <WorldSection title="💪 Workout Sessions — Global Rank" accent="fuchsia">
                  <WorldLeaderboard
                    players={displayRows.Workouts}
                    highlightId={currentPlayerId}
                    valueKey="sessions"
                    label="sessions"
                  />
                </WorldSection>
              )}

              {active === 'Time' && (
                <WorldSection title="⏱️ Training Time (minutes) — Global Rank" accent="blue">
                  <WorldLeaderboard
                    players={displayRows.Time}
                    highlightId={currentPlayerId}
                    valueKey="total_minutes"
                    label="mins"
                  />
                </WorldSection>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* global utilities for super-slick scrolling */}
      <style jsx global>{`
        /* Optional: keep OS scrollbars unobtrusive inside custom scrollers */
        .subscroll { -ms-overflow-style: none; scrollbar-width: thin; }
        .subscroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .subscroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 9999px; }
        .subscroll::-webkit-scrollbar-track { background: transparent; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }

        /* Smooth touch scrolling + avoid scroll chaining */
        .subscroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y pinch-zoom; }

        /* Fade the top/bottom edges of scroll areas for a slick look */
        .mask-fade { 
          -webkit-mask-image: linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent);
          mask-image: linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent);
        }

        /* Force NeonIconBar to a single line regardless of its internal defaults */
        .one-row-bar { overflow-x: auto; }
        .one-row-bar > * { display: inline-flex !important; flex-wrap: nowrap !important; align-items: center; width: max-content !important; }
        .one-row-bar > * > * { flex: 0 0 auto !important; }
      `}</style>
    </main>
  );
}

/** WORLD DECOR: dotted map + gradient arcs */
function WorldGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute w-[700px] h-[700px] bg-cyan-500/20 rounded-full blur-3xl -top-40 -left-40 animate-pulse" />
      <div className="absolute w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-3xl bottom-[-120px] right-[-120px] animate-pulse delay-300" />
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <defs>
          <pattern id="dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
          <clipPath id="world-rect">
            <rect x="0" y="0" width="1200" height="600" rx="0" />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="1200" height="600" fill="url(#dots)" />
        {[...Array(7)].map((_, i) => (
          <path
            key={i}
            d={`M-50 ${100 + i * 70} Q 600 ${60 + i * 90}, 1250 ${100 + i * 70}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}

function GlobeBadge() {
  return (
    <div className="relative w-10 h-10 md:w-12 md:h-12 mr-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 blur-md opacity-70" />
      <div className="relative w-full h-full rounded-full bg-black/60 border border-white/20 grid place-items-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-90">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 12h20M12 2c3 3.5 3 16.5 0 20M12 2c-3 3.5-3 16.5 0 20M4 8c2.5 1.5 13.5 1.5 16 0M4 16c2.5-1.5 13.5-1.5 16 0" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  );
}

function WorldSection({ title, accent = 'cyan', children }) {
  const accents = {
    cyan: { border: 'border-cyan-400', text: 'text-cyan-300' },
    fuchsia: { border: 'border-fuchsia-400', text: 'text-fuchsia-300' },
    blue: { border: 'border-blue-400', text: 'text-blue-300' },
    emerald: { border: 'border-emerald-400', text: 'text-emerald-300' },
  };
  const a = accents[accent] || accents.cyan;

  return (
    <section className={`bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-l-4 ${a.border} shadow-xl flex flex-col min-h-0 h-full`}>
      <h2 className={`font-bold text-lg mb-3 tracking-wider drop-shadow ${a.text}`}>{title}</h2>
      {/* Subwindow scroll (no OS scrollbar) */}
      <div className="subscroll mask-fade flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
        {children}
      </div>
    </section>
  );
}

function WorldLeaderboard({ players, highlightId, valueKey, label }) {
  const decorated = useMemo(() => {
    return (players || []).map((p, idx) => ({
      ...p,
      country: normalizeCountry(p.country),
      name: p.name || 'Player',
      _rank: idx + 1,
    }));
  }, [players]);

  return (
    <div>
      <div className="rounded-xl ring-1 ring-white/10">
        <LeaderboardPreviewCard
          players={decorated}
          highlightId={highlightId}
          valueKey={valueKey}
          label={label}
        />
      </div>
    </div>
  );
}