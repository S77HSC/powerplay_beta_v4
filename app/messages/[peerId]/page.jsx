"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

/**
 * Assumptions:
 * - messages table: id (uuid), sender_id (uuid), receiver_id (uuid), text (text), created_at (timestamptz default now())
 * - RLS policies allow:
 *    SELECT when auth.uid() IN (sender_id, receiver_id)
 *    INSERT when auth.uid() = sender_id
 */
export default function ChatPage() {
  const { peerId } = useParams(); // receiver's auth.users.id
  const [me, setMe] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState(null);
  const bottomRef = useRef(null);

  // Hydrate authed user id
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setMe(data?.user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch full conversation (both directions)
  const loadConversation = async () => {
    if (!me || !peerId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${me})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setErr(error.message);
      return;
    }
    setErr(null);
    setMsgs(data ?? []);
    // Keep view pinned to bottom after refresh
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  // Initial load + reload when ids change
  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, peerId]);

  // Realtime DB subscriptions (two one-column filters)
  useEffect(() => {
    if (!me || !peerId) return;

    const channelName = `chat-${me}-${peerId}`;
    const ch = supabase
      .channel(channelName)
      // Me -> Peer (guard the other id in callback)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${me}` },
        (payload) => {
          if (payload.new?.receiver_id === peerId) loadConversation();
        }
      )
      // Peer -> Me
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${me}` },
        (payload) => {
          if (payload.new?.sender_id === peerId) loadConversation();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, peerId]); // resubscribe only when participants change

  // Optional: low-latency broadcast room (kept, but not relied on)
  useEffect(() => {
    if (!me || !peerId) return;

    const room = `dm-${[me, peerId].sort().join("-")}`;
    const ch = supabase
      .channel(room, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "dm:new_message" }, (payload) => {
        // optimistic merge (only for this pair)
        const m = payload?.payload;
        if (!m) return;
        const isMine = m.sender_id === me && m.receiver_id === peerId;
        const isTheirs = m.sender_id === peerId && m.receiver_id === me;
        if (isMine || isTheirs) {
          setMsgs((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
          });
          requestAnimationFrame(() =>
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, peerId]);

  // Send a message (optimistic broadcast + durable insert)
  const send = async () => {
    if (!me || !peerId || !input.trim()) return;

    const now = new Date().toISOString();
    const temp = {
      id: `tmp-${crypto.randomUUID()}`,
      sender_id: me,
      receiver_id: peerId,
      text: input.trim(),
      created_at: now,
      _optimistic: true,
    };

    // Optimistic UI + broadcast
    setMsgs((prev) => [...prev, temp]);
    setInput("");
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    );

    // Optional broadcast for sub-100ms echo
    const room = `dm-${[me, peerId].sort().join("-")}`;
    supabase.channel(room).send({
      type: "broadcast",
      event: "dm:new_message",
      payload: temp,
    });

    // Durable insert
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: me,
        receiver_id: peerId,
        text: temp.text,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErr(error.message);
      // roll back optimistic item
      setMsgs((prev) => prev.filter((m) => m.id !== temp.id));
      return;
    }

    // Replace optimistic with real row
    setMsgs((prev) =>
      prev
        .map((m) => (m.id === temp.id ? data : m))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    );
  };

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold mb-3">Chat</h1>

      <div className="rounded border bg-white">
        <div
          className="h-[60vh] overflow-y-auto p-3 space-y-2 bg-neutral-50"
          style={{ scrollBehavior: "smooth" }}
        >
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-black text-white" : "bg-white border"
                  } ${m._optimistic ? "opacity-70" : ""}`}
                  title={new Date(m.created_at).toLocaleString()}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex gap-2 p-3 border-t"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 border rounded px-3 py-2"
            maxLength={5000}
          />
          <button className="px-4 py-2 rounded bg-black text-white" type="submit">
            Send
          </button>
        </form>

        {err && (
          <div className="p-2 text-sm text-red-600 border-t bg-red-50">{err}</div>
        )}
      </div>
    </main>
  );
}
