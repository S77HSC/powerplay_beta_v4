"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// If your supabase client lives elsewhere, adjust this path:
import { supabase } from "../../lib/supabase";

export default function MessagesPage() {
  const [me, setMe] = useState(null);                // { id: <uuid>, email, ... }
  const [friends, setFriends] = useState([]);        // [{ peerId: <uuid> }]
  const [activePeerId, setActivePeerId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const realtimeRef = useRef(null);

  // ---- load current user
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user || null);
    })();
  }, []);

  // ---- load accepted friends for this user (UUID-based friends table)
  useEffect(() => {
    if (!me?.id) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Pull friends where this user is user_id or friend_id AND status is accepted
        const { data, error } = await supabase
          .from("friends")
          .select("user_id, friend_id, status")
          .eq("status", "accepted")
          .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);
        if (error) throw error;

        const peers = [];
        for (const r of data || []) {
          const peer = r.user_id === me.id ? r.friend_id : r.user_id;
          peers.push({ peerId: peer });
        }
        // De-dup
        const seen = new Set();
        const uniq = peers.filter(p => (seen.has(p.peerId) ? false : (seen.add(p.peerId), true)));
        setFriends(uniq);

        // Auto-select first peer if none selected
        if (!activePeerId && uniq.length) setActivePeerId(uniq[0].peerId);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Failed to load friends.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // ---- load messages for the active conversation
  useEffect(() => {
    if (!me?.id || !activePeerId) { setMsgs([]); return; }

    (async () => {
      setErr("");
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, sender_id, recipient_id, content, created_at")
          .or(
            `and(sender_id.eq.${me.id},recipient_id.eq.${activePeerId}),and(sender_id.eq.${activePeerId},recipient_id.eq.${me.id})`
          )
          .order("created_at", { ascending: true });
        if (error) throw error;
        setMsgs(data || []);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Failed to load messages.");
      }
    })();

    // optional realtime refresh (won't create friendships—just updates view)
    if (realtimeRef.current) { try { supabase.removeChannel(realtimeRef.current); } catch {}
      realtimeRef.current = null; }
    const ch = supabase
      .channel(`msgs-${me.id}-${activePeerId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new;
        if (
          (m.sender_id === me.id && m.recipient_id === activePeerId) ||
          (m.sender_id === activePeerId && m.recipient_id === me.id)
        ) {
          setMsgs(prev => [...prev, m]);
        }
      })
      .subscribe();
    realtimeRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} realtimeRef.current = null; };
  }, [me?.id, activePeerId]);

  // ---- INLINE GUARD: require accepted friendship before sending
  async function requireAcceptedFriendship(myUuid, peerUuid) {
    const { data, error } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(
        `and(user_id.eq.${myUuid},friend_id.eq.${peerUuid}),and(user_id.eq.${peerUuid},friend_id.eq.${myUuid})`
      )
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("You need an approved friendship before you can chat.");
    }
  }

  // ---- send
  async function send() {
    setErr("");
    if (!me?.id || !activePeerId) return;
    const text = input.trim();
    if (!text) return;

    try {
      // ⛔️ This is the key: block unless friendship is already accepted.
      // (Parent approval → pending → accept → server inserts into `friends`.)
      await requireAcceptedFriendship(me.id, activePeerId);

      const { error } = await supabase.from("messages").insert({
        sender_id: me.id,
        recipient_id: activePeerId,
        content: text,
      });
      if (error) throw error;

      setInput("");
    } catch (e) {
      console.error(e);
      setErr(typeof e?.message === "string" ? e.message : "Failed to send.");
    }
  }

  const active = useMemo(
    () => friends.find(f => f.peerId === activePeerId) || null,
    [friends, activePeerId]
  );

  return (
    <main className="flex min-h-[80vh] text-white">
      {/* Sidebar: accepted friends */}
      <aside className="w-64 border-r border-white/10 p-3">
        <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-400">Friends</h2>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : friends.length === 0 ? (
          <div className="text-gray-400 text-sm">No accepted friends yet.</div>
        ) : (
          <ul className="space-y-1">
            {friends.map((f) => (
              <li key={f.peerId}>
                <button
                  onClick={() => setActivePeerId(f.peerId)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${
                    activePeerId === f.peerId ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  {f.peerId.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Conversation */}
      <section className="flex-1 flex flex-col">
        <header className="border-b border-white/10 px-4 py-3">
          <div className="text-sm text-gray-400">
            {me?.email ? <>Signed in as <span className="text-white">{me.email}</span></> : "—"}
          </div>
          <div className="text-lg font-semibold">
            {activePeerId ? `Chat with ${activePeerId.slice(0, 8)}` : "Select a friend"}
          </div>
        </header>

        {err && (
          <div className="m-3 rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200 p-2 text-sm">
            {err}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activePeerId ? (
            msgs.length ? (
              msgs.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[70%] rounded-xl px-3 py-2 ${
                    m.sender_id === me?.id ? "ml-auto bg-cyan-700/40" : "bg-white/10"
                  }`}
                >
                  <div className="text-sm">{m.content}</div>
                  <div className="text-[10px] mt-1 text-gray-400">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-sm">No messages yet.</div>
            )
          ) : (
            <div className="text-gray-400 text-sm">Pick a friend to start chatting.</div>
          )}
        </div>

        <footer className="border-t border-white/10 p-3 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2"
            placeholder={
              activePeerId
                ? "Type a message…"
                : "Select a friend to chat"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            disabled={!activePeerId}
          />
          <button
            onClick={send}
            disabled={!activePeerId || !input.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          >
            Send
          </button>
        </footer>
      </section>
    </main>
  );
}
