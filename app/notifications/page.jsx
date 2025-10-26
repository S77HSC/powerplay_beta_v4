'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import NeonIconBar from '../../lobbycomponents/NeonIconBar';
import { Flame, Trophy, Star, Clock, Sparkles, CheckCircle2, X } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { motion } from 'framer-motion';
dayjs.extend(relativeTime);

// ---------- meta per notification type ----------
const TYPE_META = {
  streak_increment: { icon: <Flame className="w-6 h-6" />, accent: 'from-orange-500/60 to-amber-500/60', chip: 'text-orange-300 border-orange-400/40' },
  streak_record:    { icon: <Trophy className="w-6 h-6" />, accent: 'from-yellow-500/60 to-amber-400/60', chip: 'text-yellow-300 border-yellow-400/40' },
  skill_unlocked:   { icon: <Sparkles className="w-6 h-6" />, accent: 'from-emerald-500/60 to-green-500/60', chip: 'text-emerald-300 border-emerald-400/40' },
  xp_awarded:       { icon: <Star className="w-6 h-6" />, accent: 'from-sky-500/60 to-blue-500/60', chip: 'text-sky-300 border-sky-400/40' },
  daily_completed:  { icon: <CheckCircle2 className="w-6 h-6" />, accent: 'from-fuchsia-500/60 to-purple-500/60', chip: 'text-fuchsia-300 border-fuchsia-400/40' },
  daily_missed:     { icon: <Clock className="w-6 h-6" />, accent: 'from-rose-500/60 to-red-500/60', chip: 'text-rose-300 border-rose-400/40' },
  weekly_summary:   { icon: <Trophy className="w-6 h-6" />, accent: 'from-pink-500/60 to-violet-500/60', chip: 'text-pink-300 border-pink-400/40' },
};
const metaFor = (type) =>
  TYPE_META[type] || { icon: <Star className="w-6 h-6" />, accent: 'from-slate-500/60 to-gray-500/60', chip: 'text-slate-300 border-slate-400/40' };

export default function NotificationsPage() {
  // ---------- state ----------
  const [userId, setUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' or a specific type

  const timeAgo = (iso) => (iso ? dayjs(iso).fromNow() : '');

  // ---------- page should scroll (and fill iOS viewport) ----------
  useEffect(() => {
    // ensure lobby scroll lock isn't lingering
    document.body.classList.remove('is-stage');
    document.body.style.overflow = '';

    const setVh = () =>
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
    setVh();
    addEventListener('resize', setVh);
    addEventListener('orientationchange', setVh);
    return () => {
      removeEventListener('resize', setVh);
      removeEventListener('orientationchange', setVh);
    };
  }, []);

  // ---------- helpers: notifications + badge ----------
  function updateBadge(unreadDeltaOrCount, isAbsolute = false) {
    try {
      const curr = Number(localStorage.getItem('notificationsUnread') || '0');
      const next = Math.max(0, isAbsolute ? Number(unreadDeltaOrCount || 0) : curr + Number(unreadDeltaOrCount || 0));
      localStorage.setItem('notificationsUnread', String(next));
      window.dispatchEvent(new CustomEvent('notifications:unread', { detail: next }));
    } catch {}
  }

  async function notifyUser(title, body) {
    try {
      if (!('Notification' in window)) return;
      // ask once
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      new Notification(title || 'New notification', {
        body: body || 'You have a new message',
        // icon: '/icons/icon-192.png',
        tag: 'pp-notify', // collapse duplicates
      });
    } catch {}
  }

  // ---------- data ----------
  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setError('You need to log in.');
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('player_auth_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);

      // set badge from current unread
      const unread = (data || []).reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0);
      updateBadge(unread, true);
    } catch (e) {
      setError(e.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    setMarking(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('player_auth_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      updateBadge(0, true); // zero unread
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-read'));
        localStorage.setItem('notificationsReadAt', String(Date.now()));
      }
    } catch (e) {
      console.error('Mark read error:', e);
    } finally {
      setMarking(false);
    }
  };

  const toggleRead = async (n) => {
    const next = !n.is_read;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: next })
      .eq('id', n.id)
      .eq('player_auth_id', userId);
    if (!error) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: next } : x)));
      updateBadge(next ? -1 : +1); // if marking read → -1, unread → +1
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-read'));
        localStorage.setItem('notificationsReadAt', String(Date.now()));
      }
    }
  };

  const deleteItem = async (n) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', n.id)
      .eq('player_auth_id', userId);
    if (!error) {
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.is_read) updateBadge(-1);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-read'));
        localStorage.setItem('notificationsReadAt', String(Date.now()));
      }
    }
  };

  useEffect(() => {
    (async () => {
      await fetchNotifications();
      await markAllRead(); // auto mark when opening the inbox
    })();
  }, []);

  // ---------- realtime: new notifications -> show, ping, bump badge ----------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('realtime:notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `player_auth_id=eq.${userId}` },
        (payload) => {
          setItems((prev) => [payload.new, ...prev]);
          notifyUser(payload?.new?.title, payload?.new?.body);
          updateBadge(+1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ---------- grouping & filtering ----------
  const bucketFor = (d) => {
    const date = dayjs(d);
    if (date.isSame(dayjs(), 'day')) return 'Today';
    if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday';
    if (date.isAfter(dayjs().startOf('week'))) return 'This Week';
    return 'Earlier';
  };

  const visibleItems = useMemo(
    () => items.filter(n => (typeFilter === 'all' ? true : n.type === typeFilter)),
    [items, typeFilter]
  );

  const groups = visibleItems.reduce((acc, n) => {
    const bucket = bucketFor(n.created_at);
    (acc[bucket] ||= []).push(n);
    return acc;
  }, {});
  const orderedBuckets = ['Today', 'Yesterday', 'This Week', 'Earlier'].filter((b) => groups[b]?.length);

  return (
    <main
      className="min-h-[calc(var(--app-vh,1vh)*100)] text-white relative bg-[#090b14] overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* background */}
      <GridBackground />

      <div className="relative max-w-6xl mx-auto px-4 py-10 z-10">
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <NeonIconBar current="notifications" />

            <div className="flex items-center gap-3">
              <div className="text-right">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-widest uppercase text-cyan-300 drop-shadow-[0_0_12px_#00f0ff]">
                  Notifications
                </h1>
                <p className="text-white/70 text-sm">Your latest streaks, XP, skills & summaries.</p>
              </div>
              <BellBadge />
            </div>
          </div>
        </motion.header>

        {/* FILTERS + ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All' },
              { key: 'xp_awarded', label: 'XP' },
              { key: 'streak_increment', label: 'Streaks' },
              { key: 'streak_record', label: 'Records' },
              { key: 'skill_unlocked', label: 'Skills' },
              { key: 'daily_completed', label: 'Daily' },
              { key: 'daily_missed', label: 'Missed' },
              { key: 'weekly_summary', label: 'Weekly' },
            ].map((f) => (
              <motion.button
                key={f.key}
                whileHover={{ scale: 1.05 }}
                onClick={() => setTypeFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold tracking-wide transition-all
                  ${typeFilter === f.key
                    ? 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black shadow-[0_0_15px_rgba(0,255,255,0.6)]'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
              >
                {f.label}
              </motion.button>
            ))}
          </div>

          <div className="flex-1" />

          {/* actions */}
          <div className="flex gap-2">
            <button
              onClick={fetchNotifications}
              className="bg-white/10 border border-white/20 rounded-2xl px-3 py-2 text-sm hover:bg-white/15 transition"
            >
              Refresh
            </button>
            <button
              onClick={markAllRead}
              disabled={marking}
              className="rounded-2xl px-3 py-2 text-sm font-semibold text-black bg-amber-400 hover:brightness-95 disabled:opacity-60"
            >
              {marking ? 'Marking…' : 'Mark all read'}
            </button>
          </div>
        </div>

        {/* BODY */}
        <section className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-l-4 border-cyan-400 shadow-xl">
          <h2 className="font-bold text-lg mb-3 tracking-wider drop-shadow text-cyan-300">
            🔔 Inbox
          </h2>

          {/* scrollable feed inside card; scrollbar hidden */}
          <div className="subscroll h-[68vh] overflow-y-auto overscroll-contain rounded-lg pr-1">
            {loading ? (
              <div className="text-center text-white/70 py-10">Loading…</div>
            ) : error ? (
              <div className="text-center text-rose-400 py-10">{error}</div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center text-white/70 py-10">Nothing here yet.</div>
            ) : (
              <div className="space-y-8">
                {['Today', 'Yesterday', 'This Week', 'Earlier'].filter((b) => groups[b]?.length).map((bucket) => (
                  <section key={bucket} className="space-y-3">
                    <h3 className="text-xs uppercase tracking-wider text-white/70 pl-1">{bucket}</h3>

                    {groups[bucket].map((n, idx) => {
                      const meta = metaFor(n.type);
                      return (
                        <div
                          key={n.id}
                          onClick={() => toggleRead(n)}
                          className={`relative overflow-hidden rounded-2xl border ${
                            n.is_read ? 'border-white/10' : 'border-white/20'
                          } bg-white/10 backdrop-blur-md shadow hover:shadow-lg transition-all cursor-pointer`}
                          style={{ animation: `fadeInUp 350ms ease ${idx * 40}ms both` }}
                        >
                          {/* Accent strip */}
                          <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${meta.accent}`} />

                          <div className="p-4 sm:p-5">
                            <div className="flex items-start gap-4">
                              <div className="shrink-0 rounded-xl p-2 bg-white/10 ring-1 ring-white/20">
                                {meta.icon}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.chip}`}>
                                        {n.type.replace('_', ' ')}
                                      </span>
                                      {!n.is_read && <span className="text-[10px] uppercase tracking-wide text-amber-300">New</span>}
                                    </div>
                                    <h4 className="mt-1 text-base sm:text-lg font-bold text-white truncate">
                                      {n.title}
                                    </h4>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-gray-300 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleRead(n); }}
                                      title={n.is_read ? 'Mark as unread' : 'Mark as read'}
                                      className="rounded-lg px-2 py-1 text-xs bg-white/10 hover:bg-white/15 border border-white/15"
                                    >
                                      {n.is_read ? 'Unread' : 'Read'}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteItem(n); }}
                                      title="Delete"
                                      className="rounded-lg p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <p className="mt-1 text-sm text-gray-200">{n.body}</p>
                                {n.deeplink && (
                                  <Link
                                    href={n.deeplink}
                                    className="inline-block mt-2 text-sm text-cyan-300 hover:underline"
                                    onClick={(e) => { e.stopPropagation(); if (!n.is_read) toggleRead(n); }}
                                  >
                                    Open →
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* tiny keyframe + hide scrollbar */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .subscroll { scrollbar-width: none; }
        .subscroll::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </main>
  );
}

/** dotted world-style background to match leaderboard */
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* gradient blobs */}
      <div className="absolute w-[700px] h-[700px] bg-cyan-500/20 rounded-full blur-3xl -top-40 -left-40 animate-pulse" />
      <div className="absolute w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-3xl bottom-[-120px] right-[-120px] animate-pulse delay-300" />

      {/* dotted grid + soft arcs */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <defs>
          <pattern id="dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
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

function BellBadge() {
  return (
    <div className="relative w-14 h-14 mr-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 blur-md opacity-70" />
      <div className="relative w-full h-full rounded-full bg-black/60 border border-white/20 grid place-items-center">
        {/* bell icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="opacity-90">
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2ZM18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
    </div>
  );
}
