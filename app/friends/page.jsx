"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

import FriendFinder from "./FriendFinder";
import PendingFriendRequests from "./PendingFriendRequests";
import SentFriendRequests from "./SentFriendRequests";
import NeonIconBar from "../../lobbycomponents/NeonIconBar";
import FloatingDM from "../../components/FloatingDM";

/* ---------------- Config ---------------- */
const AVATAR_BUCKET = "avatars";
// Shorter Friends list height (keeps the three blocks up)
const FRIENDS_LIST_H = "min(42vh, 360px)";
// Offsets for fixed overlays (neon bar at top, tray at bottom). Override in global CSS if needed.
// Example override: :root { --chrome-top: 112px; --chrome-bottom: 20px; }
const CHROME_TOP_VAR = "var(--chrome-top, 112px)";
const CHROME_BOTTOM_VAR = "var(--chrome-bottom, 16px)";

/* ---------------- Helpers ---------------- */

const dedupById = (arr) => {
  const seen = new Set();
  const out = [];
  for (const m of arr ?? []) {
    if (m?.id && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
};

const isValidHttpUrl = (u) => {
  if (!u || typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** Convert storage path -> public URL in the `avatars` bucket. */
const toPublicUrl = (value) => {
  if (!value) return null;
  if (isValidHttpUrl(value)) return value;
  const clean = String(value).replace(/^\/+/, "");
  const pathInBucket = clean.startsWith(`${AVATAR_BUCKET}/`)
    ? clean.slice(`${AVATAR_BUCKET}/`.length)
    : clean;
  try {
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(pathInBucket);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
};

/* ---- Tiny cache for friends (5 min) ---- */
const FRIENDS_CACHE_KEY = "pp_friends_cache_v1";
const FRIENDS_CACHE_TTL_MS = 5 * 60 * 1000;
const loadFriendsFromCache = () => {
  try {
    const raw = localStorage.getItem(FRIENDS_CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!Array.isArray(data) || !at) return null;
    if (Date.now() - at > FRIENDS_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
};
const saveFriendsToCache = (friends) => {
  try {
    localStorage.setItem(
      FRIENDS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data: friends })
    );
  } catch {}
};

/* --------------- Page Component --------------- */

export default function FriendsPage() {
  // me
  const [me, setMe] = useState(null);

  // friends / presence
  const [friends, setFriends] = useState([]); // [{ id, username, avatar_url }]
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [friendsErr, setFriendsErr] = useState(null);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const presenceChRef = useRef(null);

  // chat UI (simple pane on the right)
  const [active, setActive] = useState(null); // friend id (uuid)
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [chatErr, setChatErr] = useState(null);
  const bottomRef = useRef(null);

  // reactions
  const [reactions, setReactions] = useState({}); // { [messageId]: { [emoji]: count } }
  const [myReacts, setMyReacts] = useState({}); // { [messageId]: Set(emoji) }
  const [pickerForId, setPickerForId] = useState(null);

  // realtime refs
  const friendsChRef = useRef(null);
  const chatDbChRef = useRef(null);
  const chatCastChRef = useRef(null);
  const reactChRef = useRef(null);

  // identify user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMe(user?.id || null));
  }, []);
  useEffect(() => {
    try {
      localStorage.removeItem(FRIENDS_CACHE_KEY);
    } catch {}
  }, [me]);

  /* --------- Presence (global) ---------- */
  useEffect(() => {
    if (!me) return;
    if (presenceChRef.current) {
      try {
        supabase.removeChannel(presenceChRef.current);
      } catch {}
      presenceChRef.current = null;
    }
    const ch = supabase
      .channel("presence-users", { config: { presence: { key: me } } })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        setOnlineIds(new Set(Object.keys(state || {})));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await ch.track({ at: Date.now() });
          } catch {}
        }
      });
    presenceChRef.current = ch;
    return () => {
      if (presenceChRef.current) {
        try {
          supabase.removeChannel(presenceChRef.current);
        } catch {}
        presenceChRef.current = null;
      }
    };
  }, [me]);

  const isOnline = (id) => onlineIds.has(id);

  /* --------- FRIENDS: load + subscribe ---------- */
  useEffect(() => {
    if (!me) return;

    async function loadFriends() {
      setLoadingFriends(true);
      setFriendsErr(null);
      try {
        const { data: rels, error: relErr } = await supabase
          .from("friends")
          .select("user_id, friend_id, status")
          .eq("status", "accepted")
          .or(`user_id.eq.${me},friend_id.eq.${me}`);
        if (relErr) throw relErr;

        const otherIds = Array.from(
          new Set((rels ?? []).map((r) => (r.user_id === me ? r.friend_id : r.user_id)))
        );
        if (otherIds.length === 0) {
          setFriends([]);
          setActive(null);
          return;
        }

        const [{ data: profiles }, { data: players }] = await Promise.all([
          supabase.from("profiles").select("id, username, avatar_url").in("id", otherIds),
          supabase.from("players").select("auth_id, name, avatar_url").in("auth_id", otherIds),
        ]);

        const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
        const playerByAuth = new Map((players ?? []).map((p) => [p.auth_id, p]));

        const list = otherIds
          .map((id) => {
            const prof = profById.get(id);
            const plyr = playerByAuth.get(id);
            const username = prof?.username || plyr?.name || id.slice(0, 8);
            const rawAvatar = plyr?.avatar_url || prof?.avatar_url || null;
            const avatar_url = toPublicUrl(rawAvatar);
            return { id, username, avatar_url };
          })
          .sort((a, b) => (a.username || "").localeCompare(b.username || ""));

        saveFriendsToCache(list);
        setFriends(list);
        if (!active && list.length) setActive(list[0].id);
      } catch (e) {
        setFriendsErr(e.message || "Failed to load friends.");
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    }

    const cached = loadFriendsFromCache();
    if (cached && cached.length) {
      setFriends(cached);
      if (!active) setActive(cached[0].id);
    }
    loadFriends();

    if (friendsChRef.current) {
      try {
        supabase.removeChannel(friendsChRef.current);
      } catch {}
      friendsChRef.current = null;
    }
    const ch = supabase
      .channel("friends-accepted")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends", filter: `user_id=eq.${me}` },
        loadFriends
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends", filter: `friend_id=eq.${me}` },
        loadFriends
      )
      .subscribe();
    friendsChRef.current = ch;
    return () => {
      if (friendsChRef.current) {
        try {
          supabase.removeChannel(friendsChRef.current);
        } catch {}
        friendsChRef.current = null;
      }
    };
  }, [me, active]);

  /* --------- CHAT: load on active change ---------- */
  useEffect(() => {
    if (!me || !active) return;

    async function loadConversation() {
      setChatErr(null);
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, text, created_at")
        .or(
          `and(sender_id.eq.${me},receiver_id.eq.${active}),and(sender_id.eq.${active},receiver_id.eq.${me})`
        )
        .order("created_at", { ascending: true });
      if (error) {
        setChatErr(error.message);
        setMsgs([]);
        return;
      }
      setMsgs(dedupById(data || []));

      // Load reactions for visible messages
      const ids = (data || []).map((m) => m.id);
      if (ids.length) {
        const { data: rdata, error: rerr } = await supabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", ids);
        if (!rerr) {
          const agg = {};
          const mine = {};
          for (const r of rdata || []) {
            agg[r.message_id] ||= {};
            agg[r.message_id][r.emoji] = (agg[r.message_id][r.emoji] || 0) + 1;
            if (r.user_id === me) {
              (mine[r.message_id] ||= new Set()).add(r.emoji);
            }
          }
          setReactions(agg);
          setMyReacts(mine);
        }
      } else {
        setReactions({});
        setMyReacts({});
      }

      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }

    loadConversation();

    if (chatDbChRef.current) {
      try {
        supabase.removeChannel(chatDbChRef.current);
      } catch {}
      chatDbChRef.current = null;
    }
    if (chatCastChRef.current) {
      try {
        supabase.removeChannel(chatCastChRef.current);
      } catch {}
      chatCastChRef.current = null;
    }
    if (reactChRef.current) {
      try {
        supabase.removeChannel(reactChRef.current);
      } catch {}
      reactChRef.current = null;
    }

    const chDB = supabase
      .channel(`chat-db-${me}-${active}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${me}` },
        (p) => {
          if (p.new?.receiver_id === active) loadConversation();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${me}` },
        (p) => {
          if (p.new?.sender_id === active) loadConversation();
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        setMsgs((prev) => (prev || []).filter((m) => m.id !== p.old?.id));
      })
      .subscribe();
    chatDbChRef.current = chDB;

    const room = `dm-${[me, active].sort().join("-")}`;
    const chCast = supabase
      .channel(room, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "dm" }, (e) => {
        const m = e?.payload;
        if (!m) return;
        const ok =
          (m.sender_id === me && m.receiver_id === active) ||
          (m.sender_id === active && m.receiver_id === me);
        if (ok) setMsgs((prev) => dedupById([...(prev || []), m]));
      })
      .subscribe();
    chatCastChRef.current = chCast;

    // Realtime reactions (ignore own events to prevent double-counting;
    // we already applied them optimistically in toggleReaction)
    const chReact = supabase
      .channel(`reacts-${me}-${active}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (p) => {
          const r = p.new;
          if (!r?.message_id) return;
          if (r.user_id === me) return; // ignore my own optimistic event
          setReactions((prev) => ({
            ...prev,
            [r.message_id]: {
              ...(prev[r.message_id] || {}),
              [r.emoji]: (prev[r.message_id]?.[r.emoji] || 0) + 1,
            },
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (p) => {
          const r = p.old;
          if (!r?.message_id) return;
          if (r.user_id === me) return; // ignore my own optimistic removal
          setReactions((prev) => {
            const cur = { ...(prev[r.message_id] || {}) };
            if (cur[r.emoji] > 1) cur[r.emoji] -= 1;
            else delete cur[r.emoji];
            return { ...prev, [r.message_id]: cur };
          });
        }
      )
      .subscribe();
    reactChRef.current = chReact;

    return () => {
      try {
        supabase.removeChannel(chDB);
      } catch {}
      try {
        supabase.removeChannel(chCast);
      } catch {}
      try {
        supabase.removeChannel(chReact);
      } catch {}
      chatDbChRef.current = null;
      chatCastChRef.current = null;
      reactChRef.current = null;
    };
  }, [me, active]);

  // Autoscroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // send a chat message
  async function sendMessage() {
    const value = input.trim();
    if (!value || !me || !active) return;
    setChatErr(null);
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic = {
      id: tempId,
      sender_id: me,
      receiver_id: active,
      text: value,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMsgs((prev) => dedupById([...(prev || []), optimistic]));
    setInput("");
    try {
      const room = `dm-${[me, active].sort().join("-")}`;
      supabase.channel(room).send({ type: "broadcast", event: "dm", payload: optimistic });
    } catch {}
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: active, text: value })
      .select("id, sender_id, receiver_id, text, created_at")
      .single();
    if (error) {
      setMsgs((prev) => (prev || []).filter((m) => m.id !== tempId));
      setChatErr(`Send failed: ${error.message}`);
      return;
    }
    setMsgs((prev) =>
      dedupById((prev || []).map((m) => (m.id === tempId ? data : m)).concat([data]))
    );
  }

  // delete own message
  async function deleteMessage(mid) {
    try {
      const { error } = await supabase.from("messages").delete().eq("id", mid);
      if (error) throw error;
      setMsgs((prev) => (prev || []).filter((m) => m.id !== mid));
    } catch (e) {
      setChatErr(e.message || "Failed to delete message.");
    }
  }

  // toggle reaction (optimistic + sticky)
  async function toggleReaction(mid, emoji) {
    if (!me) return;
    const current = reactions[mid] || {};
    const mineSet = myReacts[mid] instanceof Set ? new Set(myReacts[mid]) : new Set();
    const already = mineSet.has(emoji);

    // optimistic
    const prevReactions = reactions;
    const prevMy = myReacts;
    const nextReactions = { ...reactions, [mid]: { ...(current || {}) } };
    const nextMy = { ...myReacts, [mid]: new Set(mineSet) };

    if (already) {
      const count = nextReactions[mid][emoji] || 0;
      if (count > 1) nextReactions[mid][emoji] = count - 1;
      else delete nextReactions[mid][emoji];
      nextMy[mid].delete(emoji);
    } else {
      nextReactions[mid][emoji] = (nextReactions[mid][emoji] || 0) + 1;
      nextMy[mid].add(emoji);
    }
    setReactions(nextReactions);
    setMyReacts(nextMy);

    try {
      if (already) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", mid)
          .eq("user_id", me)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("message_reactions")
          .insert({ message_id: mid, user_id: me, emoji });
        if (error) throw error;
      }
    } catch (e) {
      // revert
      setReactions(prevReactions);
      setMyReacts(prevMy);
      setChatErr(e?.message ? `Reaction failed: ${e.message}` : "Failed to react.");
    }
  }

  const PICK = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🙏"]; // quick picker

  return (
    <>
      {/* Fixed neon bar (stays above the content) */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50">
        <NeonIconBar current="friends" />
      </div>

      {/* Main viewport-bounded area: never overlaps bar or bottom tray */}
      <main
        className="fixed inset-x-0 overflow-hidden text-white"
        style={{
          top: `calc(${CHROME_TOP_VAR} + env(safe-area-inset-top))`,
          bottom: `calc(${CHROME_BOTTOM_VAR} + env(safe-area-inset-bottom))`,
          colorScheme: "dark",
        }}
      >
        <FriendsBackdrop />

        {/* Full-height content column: header + grid */}
        <div className="h-full max-w-7xl mx-auto px-4 pt-4 pb-4 relative z-10 flex flex-col">
          {/* Header */}
          <header className="mb-4 shrink-0">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-wide">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-sky-400">
                Friends & Messages
              </span>
            </h1>
            <p className="text-gray-300">
              Manage friends, then chat — avatars from <code>{AVATAR_BUCKET}</code> (falls back to{" "}
              <code>profiles</code>).
            </p>
          </header>

          {/* GRID fills the rest; left column now scrolls if needed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* LEFT: friends + requests + finder (scrollable column) */}
            <section className="flex flex-col min-h-0 pe-1 gap-6 overflow-y-auto overscroll-contain">
              {/* Friends list */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Your friends</h2>
                  <span className="text-sm text-gray-400">{friends.length}</span>
                </div>

                <div
                  className="rounded-lg border border-white/5 overscroll-contain"
                  style={{ height: FRIENDS_LIST_H, overflowY: "auto" }}
                >
                  {loadingFriends ? (
                    <p className="text-sm text-gray-400 p-3">Loading friends…</p>
                  ) : friendsErr ? (
                    <p className="text-sm text-rose-400 p-3">{friendsErr}</p>
                  ) : friends.length === 0 ? (
                    <p className="text-sm text-gray-400 p-3">No friends yet — try searching below.</p>
                  ) : (
                    <ul className="divide-y divide-white/10">
                      {friends.map((f) => {
                        const showImg = isValidHttpUrl(f.avatar_url);
                        return (
                          <li
                            key={f.id}
                            className={`py-3 px-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                              active === f.id ? "bg-white/10" : "hover:bg-white/5"
                            }`}
                            onClick={() => setActive(f.id)}
                            title="Open chat"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {showImg ? (
                                  <Image
                                    src={f.avatar_url}
                                    alt={f.username}
                                    width={36}
                                    height={36}
                                    className="rounded-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                    {(f.username || f.id).slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span
                                  className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full ring-2 ring-black/70 ${
                                    isOnline(f.id) ? "bg-green-500" : "bg-neutral-600"
                                  }`}
                                  title={isOnline(f.id) ? "Online" : "Offline"}
                                />
                              </div>
                              <span className="font-medium">{f.username}</span>
                            </div>
                            <span className="text-xs text-cyan-300 hover:underline">Message</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Requests */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shrink-0">
                <h2 className="text-lg font-semibold mb-3">Requests to you</h2>
                <PendingFriendRequests />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shrink-0">
                <h2 className="text-lg font-semibold mb-3">Requests you sent</h2>
                <SentFriendRequests />
              </div>

              {/* Finder */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shrink-0">
                <h2 className="text-lg font-semibold mb-3">Find friends</h2>
                <FriendFinder me={me} />
                <p className="text-xs text-gray-400 mt-3">
                  Tip: search by username or <code>players.name</code>.
                </p>
              </div>
            </section>

            {/* RIGHT: chat (fills column; internal scroll) */}
            <section className="lg:col-span-2 min-h-0">
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 flex flex-col">
                <div className="mb-3 flex items-end justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">Chat</h2>
                    {active ? (
                      <p className="text-sm text-gray-300">
                        Talking with{" "}
                        <span className="text-cyan-300 font-medium">
                          {friends.find((f) => f.id === active)?.username || active?.slice(0, 8)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Select a friend on the left.</p>
                    )}
                  </div>
                  {active && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] bg-gradient-to-r from-fuchsia-600/30 to-cyan-500/30 border border-white/10 text-cyan-100">
                      LIVE
                    </span>
                  )}
                </div>

                {/* Messages pane */}
                <div className="rounded-lg p-3 space-y-3 bg-black/50 border border-white/10 grow overflow-y-auto overscroll-contain">
                  {!active ? (
                    <div className="text-sm text-gray-500">No conversation selected.</div>
                  ) : (
                    msgs.map((m) => {
                      const mine = m.sender_id === me;
                      const r = reactions[m.id] || {};
                      const my = myReacts[m.id] || new Set();
                      const hasReacts = Object.keys(r).length > 0;

                      return (
                        <div
                          key={m.id}
                          className={`group relative max-w-[78%] ${mine ? "ml-auto" : ""}`}
                          title={new Date(m.created_at).toLocaleString()}
                        >
                          {/* Hover actions */}
                          <div
                            className={`absolute -top-2 ${
                              mine ? "right-0" : "left-0"
                            } translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1`}
                          >
                            <button
                              className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                              onClick={() => toggleReaction(m.id, "👍")}
                              title="Like"
                            >
                              👍
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                              onClick={() => setPickerForId((v) => (v === m.id ? null : m.id))}
                              title="Add reaction"
                            >
                              😊
                            </button>
                            {mine && (
                              <button
                                className="text-xs px-2 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30"
                                onClick={() => deleteMessage(m.id)}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            )}
                          </div>

                          {/* Bubble */}
                          <div
                            className={`${
                              mine
                                ? "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-lg"
                                : "bg-white/10 text-neutral-100 border border-white/10"
                            } rounded-2xl px-4 py-2`}
                          >
                            <div className="text-[11px] opacity-70 mb-1">
                              {mine ? "You" : "Them"} • {new Date(m.created_at).toLocaleString()}
                            </div>
                            <div className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.text}
                            </div>

                            {/* Always-visible reactions row inside bubble */}
                            {hasReacts && (
                              <div
                                className={`mt-1 flex flex-wrap gap-1 ${
                                  mine ? "justify-end" : ""
                                }`}
                              >
                                {Object.entries(r).map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(m.id, emoji)}
                                    className={`text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-black/40 hover:bg-black/60 backdrop-blur ${
                                      my.has(emoji) ? "ring-1 ring-cyan-300" : ""
                                    }`}
                                    title={my.has(emoji) ? "Remove reaction" : "Add reaction"}
                                  >
                                    <span>{emoji}</span>
                                    <span className="ml-1 opacity-80">{count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Emoji picker popover */}
                          {pickerForId === m.id && (
                            <div
                              className={`absolute ${mine ? "right-0" : "left-0"} mt-1 z-10 rounded-xl border border-white/10 bg-black/90 backdrop-blur p-2 shadow-xl`}
                              onMouseLeave={() => setPickerForId(null)}
                            >
                              <div className="flex gap-1 flex-wrap max-w-[220px]">
                                {PICK.map((e) => (
                                  <button
                                    key={e}
                                    className="px-2 py-1 rounded-lg hover:bg-white/10"
                                    onClick={() => {
                                      toggleReaction(m.id, e);
                                      setPickerForId(null);
                                    }}
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Composer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="mt-3 flex gap-2 shrink-0"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={active ? "Type a message…" : "Pick a friend first…"}
                    className="flex-1 rounded-xl bg-black/50 border border-white/10 px-4 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    maxLength={5000}
                    disabled={!active}
                    autoComplete="off"
                  />
                  <button
                    className="px-5 py-2 rounded-xl bg-white text-black font-semibold disabled:opacity-40"
                    type="submit"
                    disabled={!active || !input.trim()}
                  >
                    Send
                  </button>
                </form>

                {chatErr && <div className="text-sm text-rose-400 mt-2 shrink-0">{chatErr}</div>}
              </div>
            </section>
          </div>
        </div>

        {/* Floating DM tray uses the SAME avatars */}
        <FloatingDM
          players={friends.map((f) => ({
            auth_id: f.id,
            name: f.username,
            avatar_url: f.avatar_url,
          }))}
        />
      </main>
    </>
  );
}

/* ---------- Background (neon grid + vignettes) ---------- */
function FriendsBackdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[#06121a] -z-10" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[.08] mix-blend-screen -z-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #8be9fd 1px, transparent 1px),
            linear-gradient(to bottom, #8be9fd 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          animation: "friendsGrid 16s linear infinite",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(1100px 700px at 50% 0%, rgba(34,211,238,.14), transparent 70%),
            radial-gradient(900px 700px at 20% 100%, rgba(16,185,129,.10), transparent 70%),
            radial-gradient(1200px 900px at 80% 55%, rgba(59,130,246,.08), transparent 70%)
          `,
        }}
      />
      <style jsx>{`
        @keyframes friendsGrid {
          from {
            background-position: 0px 0px, 0px 0px;
          }
          to {
            background-position: 40px 80px, 40px 80px;
          }
        }
      `}</style>
    </>
  );
}