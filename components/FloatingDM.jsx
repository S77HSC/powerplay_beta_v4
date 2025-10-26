"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

const roomFor = (a, b) => `dm-${[a, b].sort().join("-")}`;
const dedupById = (arr) => {
  const seen = new Set();
  const out = [];
  for (const m of arr) {
    const id = m?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
};

/**
 * Floating tray for DMs.
 * - Accepts `players` from your Friends/Chat page and prefers that data
 * - Enriches with profiles.username + avatar_url
 * - Falls back to message history to discover peers
 */
export default function FloatingDM({ players = [] }) {
  // UI
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  // chat state
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);                 // [{ id, username, avatar_url }]
  const [profileById, setProfileById] = useState(new Map());  // id -> profile
  const [threads, setThreads] = useState([]);
  const [activePeer, setActivePeer] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState(null);

  // presence / typing / reads
  const [onlineIds, setOnlineIds] = useState(new Set()); // Set<string>
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState(null); // ISO string | null

  const bottomRef = useRef(null);

  // realtime channel refs
  const inboxChRef = useRef(null);
  const chatChRef = useRef(null);
  const broadcastChRef = useRef(null);
  const presenceChRef = useRef(null);
  const readsChRef = useRef(null);

  // ---- Beep + Notification helpers ----
  const audioCtxRef = useRef(null);
  const enableBeep = () => {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
  };
  const beep = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.02;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, 120);
    } catch {}
  };
  const requestNotifPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  };

  // SSR-safe portal flag
  useEffect(() => { setMounted(true); }, []);

  // auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setMe(data?.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // presence (global): who is online
  useEffect(() => {
    if (!me) return;
    // clean prev
    if (presenceChRef.current) {
      try { supabase.removeChannel(presenceChRef.current); } catch {}
      presenceChRef.current = null;
    }
    const ch = supabase
      .channel("presence-users", { config: { presence: { key: me } } })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState(); // { userId: [{...metas}] }
        const ids = new Set(Object.keys(state || {}));
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try { await ch.track({ at: Date.now() }); } catch {}
        }
      });

    presenceChRef.current = ch;
    return () => {
      if (presenceChRef.current) {
        try { supabase.removeChannel(presenceChRef.current); } catch {}
        presenceChRef.current = null;
      }
    };
  }, [me]);

  // ---- Seed from `players` prop & enrich from profiles ----
  useEffect(() => {
    if (!players || players.length === 0) return;

    // Build initial map from players (auth_id -> {id, username?, avatar_url?})
    const ids = players
      .map(p => p?.auth_id)
      .filter(Boolean);

    // Start with players as provisional profiles (using player.name if username missing)
    const provisional = new Map(
      players
        .filter(p => p?.auth_id)
        .map(p => [p.auth_id, {
          id: p.auth_id,
          username: p.name || null,
          avatar_url: p.avatar_url || null
        }])
    );

    // Enrich from profiles table (prefer username + avatar_url there)
    (async () => {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);

        if (profs && profs.length) {
          for (const row of profs) {
            const existing = provisional.get(row.id) || { id: row.id };
            provisional.set(row.id, {
              id: row.id,
              username: row.username || existing.username || null,
              avatar_url: row.avatar_url || existing.avatar_url || null
            });
          }
        }

        const list = Array.from(provisional.values());
        setFriends(list);
        setProfileById(new Map(list.map(p => [p.id, p])));

        // If no active peer yet, pick the first seeded one
        if (!activePeer && list.length) {
          setActivePeer(list[0].id);
        }
      } catch (e) {
        // Even if profiles fetch fails, keep player-provided data
        const list = Array.from(provisional.values());
        setFriends(list);
        setProfileById(new Map(list.map(p => [p.id, p])));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(players)]);

  // ---- Also discover peers from message history (optional union) ----
  const loadFriendsFromMessages = async () => {
    if (!me) return;

    const { data, error } = await supabase
      .from("messages")
      .select("sender_id,receiver_id")
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`);
    if (error) return console.error(error);

    const ids = new Set(
      (data ?? [])
        .flatMap(r => [r.sender_id, r.receiver_id])
        .filter(id => id && id !== me)
    );

    // filter out any already present from players
    const missing = Array.from(ids).filter(id => !profileById.has(id));
    if (!missing.length) return;

    const { data: profiles } = await supabase
      .from("profiles").select("id,username,avatar_url")
      .in("id", missing);

    const addList = (profiles ?? []).map(p => ({
      id: p.id, username: p.username || p.id.slice(0,6), avatar_url: p.avatar_url || null
    }));

    const merged = [...friends, ...addList];
    setFriends(merged);
    setProfileById(new Map(merged.map(p => [p.id, p])));
  };

  // threads & active thread loaders
  const loadThreads = async () => {
    if (!me) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) { setErr(error.message); return; }

    const map = new Map();
    for (const m of data ?? []) {
      const peer = m.sender_id === me ? m.receiver_id : m.sender_id;
      if (!map.has(peer)) map.set(peer, m);
    }
    setThreads(Array.from(map, ([peer_id, last]) => ({ peer_id, last })));
  };

  const loadActive = async () => {
    if (!me || !activePeer) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${activePeer}),and(sender_id.eq.${activePeer},receiver_id.eq.${me})`
      )
      .order("created_at", { ascending: true });
    if (error) { setErr(error.message); return; }
    setErr(null);
    setMsgs(dedupById(data ?? []));
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

    // mark as read for me (best-effort; table might not exist yet)
    try {
      await supabase.from("message_reads").upsert(
        { user_id: me, peer_id: activePeer, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,peer_id" }
      );
    } catch {}
    // get peer's read marker (so we can paint ✓✓ for my sent msgs)
    try {
      const { data: peerRead } = await supabase
        .from("message_reads")
        .select("last_read_at")
        .eq("user_id", activePeer)
        .eq("peer_id", me)
        .single();
      setPeerLastReadAt(peerRead?.last_read_at || null);
    } catch { setPeerLastReadAt(null); }
  };

  useEffect(() => { if (me) { loadThreads(); loadFriendsFromMessages(); } }, [me, profileById.size]);
  useEffect(() => { if (me) { setMsgs([]); loadActive(); } }, [me, activePeer]);

  // inbox realtime (once)
  useEffect(() => {
    if (!me) return;
    if (inboxChRef.current) { try { supabase.removeChannel(inboxChRef.current); } catch {} }
    const ch = supabase
      .channel(`inbox-${me}`)
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"messages", filter:`receiver_id=eq.${me}` },
        (p) => {
          const m = p.new;
          loadThreads();
          if (activePeer) loadActive();
          showIncomingNotification(m);
        }
      )
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"messages", filter:`sender_id=eq.${me}` },
        () => { loadThreads(); if (activePeer) loadActive(); }
      )
      .subscribe();
    inboxChRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} inboxChRef.current = null; };
  }, [me, activePeer, friends]);

  // active thread realtime (DB)
  useEffect(() => {
    if (chatChRef.current) { try { supabase.removeChannel(chatChRef.current); } catch {} chatChRef.current=null; }
    if (!me || !activePeer) return;
    const ch = supabase
      .channel(`chat-${me}-${activePeer}`)
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"messages", filter:`sender_id=eq.${me}` },
        (p) => { if (p.new?.receiver_id === activePeer) loadActive(); }
      )
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"messages", filter:`receiver_id=eq.${me}` },
        (p) => { if (p.new?.sender_id === activePeer) loadActive(); }
      )
      .subscribe();
    chatChRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} chatChRef.current = null; };
  }, [me, activePeer]);

  // active thread broadcast: typing + echo
  useEffect(() => {
    if (broadcastChRef.current) { try { supabase.removeChannel(broadcastChRef.current); } catch {} broadcastChRef.current=null; }
    if (!me || !activePeer) return;

    const ch = supabase
      .channel(roomFor(me, activePeer), { config:{ broadcast:{ self:true } } })
      .on("broadcast", { event:"dm:new_message" }, (payload) => {
        const m = payload?.payload;
        if (!m) return;
        const ok = (m.sender_id===me && m.receiver_id===activePeer) ||
                   (m.sender_id===activePeer && m.receiver_id===me);
        if (ok) setMsgs(prev => dedupById([...prev, m]));
      })
      .on("broadcast", { event:"dm:typing" }, (payload) => {
        const { from, to } = payload?.payload || {};
        if (from === activePeer && to === me) {
          setPeerTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setPeerTyping(false), 2500);
        }
      })
      .on("broadcast", { event:"dm:read" }, (payload) => {
        const { from, to, at } = payload?.payload || {};
        if (from === activePeer && to === me && at) {
          setPeerLastReadAt(at);
        }
      })
      .subscribe();

    broadcastChRef.current = ch;
    return () => {
      if (broadcastChRef.current) {
        try { supabase.removeChannel(broadcastChRef.current); } catch {}
        broadcastChRef.current = null;
      }
    };
  }, [me, activePeer]);

  // reads table realtime (optional, if table exists)
  useEffect(() => {
    if (readsChRef.current) { try { supabase.removeChannel(readsChRef.current); } catch {} readsChRef.current=null; }
    if (!me) return;

    const ch = supabase
      .channel(`reads-${me}`)
      .on("postgres_changes",
        { event:"UPDATE", schema:"public", table:"message_reads", filter:`user_id=eq.${activePeer}` },
        (p) => {
          // guard peer->me
          if (p.new?.peer_id === me) setPeerLastReadAt(p.new?.last_read_at || null);
        }
      )
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"message_reads", filter:`user_id=eq.${activePeer}` },
        (p) => {
          if (p.new?.peer_id === me) setPeerLastReadAt(p.new?.last_read_at || null);
        }
      )
      .subscribe();

    readsChRef.current = ch;
    return () => {
      if (readsChRef.current) {
        try { supabase.removeChannel(readsChRef.current); } catch {}
        readsChRef.current = null;
      }
    };
  }, [me, activePeer]);

  // unread resets
  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => { setUnread(0); }, [activePeer]);

  // helper: notify
  const showIncomingNotification = (m) => {
    const isVisibleThread = open && activePeer && (m.sender_id === activePeer || m.receiver_id === activePeer);
    const pageHidden = typeof document !== "undefined" && document.hidden;
    if (!isVisibleThread || pageHidden) {
      setUnread((n) => n + 1);
      beep();
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const sender =
          friends.find((f) => f.id === m.sender_id)?.username ||
          (m.sender_id === me ? "You" : m.sender_id.slice(0, 8));
        try { new Notification(`${sender}`, { body: (m.text || "").slice(0, 120) }); } catch {}
      }
    }
  };

  // actions
  const send = async () => {
    const text = input.trim();
    if (!me || !activePeer || !text) return;

    const temp = {
      id: `tmp-${crypto.randomUUID()}`,
      sender_id: me, receiver_id: activePeer,
      text, created_at: new Date().toISOString(), _optimistic: true,
    };

    setMsgs(prev => dedupById([...prev, temp]));
    setInput("");

    // echo
    try { broadcastChRef.current?.send({ type:"broadcast", event:"dm:new_message", payload: temp }); } catch {}

    // durable insert
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: activePeer, text })
      .select()
      .single();

    if (error) {
      setErr(error.message || "Send failed");
      setMsgs(prev => prev.filter(m => m.id !== temp.id));
      return;
    }
    setErr(null);
    setMsgs(prev => dedupById(prev.map(m => (m.id === temp.id ? data : m)).concat([data])));
    loadThreads();

    // mark my read
    try {
      const at = new Date().toISOString();
      await supabase.from("message_reads").upsert(
        { user_id: me, peer_id: activePeer, last_read_at: at },
        { onConflict: "user_id,peer_id" }
      );
      broadcastChRef.current?.send({ type:"broadcast", event:"dm:read", payload: { from: me, to: activePeer, at } });
    } catch {}
  };

  // send "typing" while composing (debounced)
  useEffect(() => {
    if (!me || !activePeer) return;
    if (!input) return;
    const t = setTimeout(() => {
      try {
        broadcastChRef.current?.send({
          type: "broadcast",
          event: "dm:typing",
          payload: { from: me, to: activePeer, at: Date.now() },
        });
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [input, me, activePeer]);

  const clearConversation = async () => {
    if (!me || !activePeer) return;
    if (!confirm("Delete this conversation for you?")) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${activePeer}),and(sender_id.eq.${activePeer},receiver_id.eq.${me})`
      );
    if (error) { setErr(error.message); return; }
    setMsgs([]); loadThreads();
    try { await supabase.from("message_reads").delete().eq("user_id", me).eq("peer_id", activePeer); } catch {}
  };

  // launcher (portal so it never hides)
  const Launcher = () => (
    <button
      aria-label="Open messages"
      onClick={() => { setOpen(true); enableBeep(); requestNotifPermission(); }}
      style={{ position: "fixed", right: "16px", bottom: "16px", zIndex: 2147483647 }}
      className="rounded-full px-4 py-3 bg-black text-white shadow-lg relative"
    >
      Messages
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full bg-rose-500 text-white text-xs flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  // tiny helpers for UI bits
  const isOnline = (id) => onlineIds.has(id);
  const getProfile = (id) => profileById.get(id) || friends.find(f => f.id === id) || null;
  const getName = (id) => {
    const p = getProfile(id);
    return p?.username || (id ? id.slice(0, 6) : "user");
  };
  const getAvatarUrl = (id) => getProfile(id)?.avatar_url || null;
  const initials = (name) => {
    if (!name) return "U";
    const parts = String(name).replace(/[^a-z0-9_ ]/gi, " ").trim().split(/\s+|_/);
    const a = (parts[0] || "").charAt(0);
    const b = (parts[1] || "").charAt(0);
    return (a + b).toUpperCase() || "U";
  };
  const colorFromId = (id) => {
    const c = Array.from(String(id || "x")).reduce((h, ch) => ((h<<5)-h) + ch.charCodeAt(0), 0);
    const palette = ["bg-sky-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-emerald-500","bg-indigo-500","bg-fuchsia-500","bg-teal-500"];
    return palette[Math.abs(c) % palette.length];
  };
  const Avatar = ({ id, size = 28, ring = false }) => {
    const url = getAvatarUrl(id);
    const name = getName(id);
    const style = { width: size, height: size };
    if (url) {
      return (
        <img
          src={url}
          alt={name}
          title={name}
          className={`rounded-full object-cover ${ring ? "ring-2 ring-white/10" : ""}`}
          style={style}
        />
      );
    }
    return (
      <div
        className={`rounded-full flex items-center justify-center text-[10px] text-white ${colorFromId(id)} ${ring ? "ring-2 ring-white/10" : ""}`}
        style={style}
        title={name}
      >
        {initials(name)}
      </div>
    );
  };

  // read helper
  const msgIsReadByPeer = (m) => {
    if (!peerLastReadAt || !m?.created_at) return false;
    try { return new Date(m.created_at) <= new Date(peerLastReadAt); } catch { return false; }
  };

  return (
    <>
      {mounted && !open && createPortal(<Launcher />, document.body)}

      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center sm:justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setOpen(false)} />

          <div className="relative m-4 w-[34rem] max-w-[95vw] rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-2xl pointer-events-auto">
            {/* Top app bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950 sticky top-0">
              <div className="font-semibold">Direct Messages</div>
              <div className="flex items-center gap-3">
                {err && <div className="text-xs text-rose-400">{err}</div>}
                <button onClick={() => setOpen(false)} className="text-sm opacity-80 hover:opacity-100" title="Close">✕</button>
              </div>
            </div>

            <div className="grid grid-cols-3 h-[28rem]">
              {/* Threads */}
              <aside className="border-r border-neutral-800 overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="p-4 text-neutral-400 text-sm">No conversations yet.</div>
                ) : (
                  <ul className="divide-y divide-neutral-800">
                    {threads.map(({ peer_id, last }) => {
                      const name = getName(peer_id);
                      const preview = (last?.text ?? "").slice(0, 80);
                      const active = activePeer === peer_id;
                      const online = isOnline(peer_id);
                      return (
                        <li key={peer_id}>
                          <button
                            className={`w-full text-left px-3 py-3 hover:bg-neutral-800 ${active ? "bg-neutral-800" : ""}`}
                            onClick={() => setActivePeer(peer_id)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar id={peer_id} size={28} ring />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-neutral-600"}`} />
                                  <div className="text-sm font-medium truncate">@{name}</div>
                                </div>
                                <div className="text-xs text-neutral-400 truncate">{preview}</div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>

              {/* Thread pane */}
              <section className="col-span-2 flex flex-col">
                {/* Sticky thread header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950 sticky top-0">
                  <div className="min-h-[28px]">
                    {activePeer ? (
                      <div className="leading-tight">
                        <div className="flex items-center gap-3">
                          <Avatar id={activePeer} size={28} ring />
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${isOnline(activePeer) ? "bg-green-500" : "bg-neutral-600"}`} />
                            <div className="text-sm font-medium">@{getName(activePeer)}</div>
                          </div>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {peerTyping ? "typing…" : `You ↔ ${getName(activePeer)}`}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-400">Pick a conversation</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivePeer(null)}
                      className="px-2 py-1 rounded border border-neutral-700 text-xs hover:bg-neutral-800"
                      title="Back to list"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={clearConversation}
                      disabled={!activePeer}
                      className="px-2 py-1 rounded border border-neutral-700 text-xs hover:bg-neutral-800 disabled:opacity-40"
                      title="Clear conversation"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollBehavior: "smooth" }}>
                  {msgs.map((m, i) => {
                    const mine = m.sender_id === me;
                    const prev = msgs[i - 1];
                    const showAvatar = !prev || prev.sender_id !== m.sender_id; // group bubbles
                    const avatarId = mine ? me : m.sender_id;
                    return (
                      <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && showAvatar && <Avatar id={avatarId} size={22} />}
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            mine ? "bg-white text-black" : "bg-neutral-800 text-neutral-100"
                          } ${m._optimistic ? "opacity-70" : ""}`}
                          title={new Date(m.created_at).toLocaleString()}
                        >
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                          {mine && (
                            <div className="text-[10px] mt-1 opacity-60 text-right">
                              {msgIsReadByPeer(m) ? "✓✓ Read" : "✓ Sent"}
                            </div>
                          )}
                        </div>
                        {mine && showAvatar && <Avatar id={avatarId} size={22} />}
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Composer */}
                <form
                  onSubmit={(e) => { e.preventDefault(); send(); }}
                  className="flex gap-2 p-3 border-t border-neutral-800 bg-neutral-950"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => { enableBeep(); requestNotifPermission(); }}
                    placeholder={activePeer ? "Message…" : "Pick a conversation…"}
                    className="flex-1 rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder:text-neutral-500"
                    maxLength={5000}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white text-black disabled:opacity-40"
                    disabled={!activePeer || !input.trim()}
                  >
                    Send
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
