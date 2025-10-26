"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ChatApprovals() {
  const [meEmail, setMeEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // children: { player_id:int, name:string, parent_verified:boolean }
  const [children, setChildren] = useState([]);
  // FR lists (INT ids)
  const [outgoingAwaiting, setOutgoingAwaiting] = useState([]); // child requester & awaiting_parent
  const [incomingPending, setIncomingPending] = useState([]);   // child addressee & pending

  // realtime channels (still supported, but no longer required for updates to show)
  const frChRef = useRef(null);
  const playersChRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // auth email (normalize to lowercase for strict match)
        const { data: u } = await supabase.auth.getUser();
        const emailRaw = u?.user?.email || "";
        const email = emailRaw.toLowerCase();
        setMeEmail(emailRaw);

        if (!email) return reset();

        // approved links -> player ids (INT)
        const { data: links, error: lerr } = await supabase
          .from("parent_links")
          .select("child_id, status")
          .eq("parent_email", email)
          .eq("status", "approved");
        if (lerr) throw lerr;

        const playerIds = (links ?? []).map(r => r.child_id).filter(Number.isFinite);
        if (!playerIds.length) return reset();

        // players (names + global permission)
        const { data: ps, error: perr } = await supabase
          .from("players")
          .select("id, name, parent_verified")
          .in("id", playerIds);
        if (perr) throw perr;

        setChildren((ps ?? []).map(p => ({
          player_id: p.id,
          name: p.name || `Player ${p.id}`,
          parent_verified: !!p.parent_verified,
        })));

        await refreshLists(playerIds);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Failed to load chat approvals.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const childIds = useMemo(() => children.map(c => c.player_id), [children]);

  // OPTIONAL realtime; UI no longer depends on it
  useEffect(() => {
    if (frChRef.current) { try { supabase.removeChannel(frChRef.current); } catch {} frChRef.current = null; }
    if (!childIds.length) return;

    const ch = supabase
      .channel(`fr-approvals-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        (p) => {
          const r = p.new || p.old; if (!r) return;
          const fromChild = childIds.includes(r.requester_id);
          const toChild   = childIds.includes(r.addressee_id);
          if (fromChild || toChild) {
            // Best-effort incremental sync
            refreshLists(childIds);
          }
        }
      ).subscribe();

    frChRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} frChRef.current = null; };
  }, [childIds]);

  useEffect(() => {
    if (playersChRef.current) { try { supabase.removeChannel(playersChRef.current); } catch {} playersChRef.current = null; }
    if (!childIds.length) return;

    const ch = supabase
      .channel(`players-children-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "players" },
        (p) => {
          const r = p.new; if (!r) return;
          if (childIds.includes(r.id)) {
            setChildren(prev => prev.map(c => c.player_id === r.id ? { ...c, parent_verified: !!r.parent_verified } : c));
          }
        }
      ).subscribe();

    playersChRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} playersChRef.current = null; };
  }, [childIds]);

  // -------- actions (optimistic) --------
  const toggleGlobalChat = async (playerId, current) => {
    setErr(null);
    // optimistic flip
    setChildren(prev => prev.map(c => c.player_id === playerId ? { ...c, parent_verified: !current } : c));

    try {
      const { error } = await supabase.from("players").update({ parent_verified: !current }).eq("id", playerId);
      if (error) throw error;

      // If enabling, promote queued → pending
      if (!current) {
        // optimistic move: remove from awaiting list for this child
        setOutgoingAwaiting(prev => prev.filter(r => !(r.requester_id === playerId && r.status === "awaiting_parent")));
        await supabase
          .from("friend_requests")
          .update({ status: "pending" })
          .eq("status", "awaiting_parent")
          .eq("requester_id", playerId);
      }
      // background refresh (keeps UI in sync even without realtime)
      await refreshLists(childIds);
    } catch (e) {
      // revert optimistic on error
      setChildren(prev => prev.map(c => c.player_id === playerId ? { ...c, parent_verified: current } : c));
      console.error(e);
      setErr(e.message || "Failed to update permission.");
    }
  };

  const approveOutgoing = async (reqId) => {
    setErr(null);
    // optimistic: move this row from awaiting → pending (remove from awaiting list)
    const row = outgoingAwaiting.find(r => r.id === reqId);
    setOutgoingAwaiting(prev => prev.filter(r => r.id !== reqId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "pending" })
        .eq("id", reqId)
        .eq("status", "awaiting_parent");
      if (error) throw error;

      await refreshLists(childIds);
    } catch (e) {
      // revert optimistic if failed
      if (row) setOutgoingAwaiting(prev => upsert(prev, row));
      console.error(e);
      setErr(e.message || "Failed to approve request.");
    }
  };

  const denyOutgoing = async (reqId) => {
    setErr(null);
    const prevRow = outgoingAwaiting.find(r => r.id === reqId);
    setOutgoingAwaiting(prev => prev.filter(r => r.id !== reqId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "denied" })
        .eq("id", reqId)
        .in("status", ["awaiting_parent","pending"]);
      if (error) throw error;

      await refreshLists(childIds);
    } catch (e) {
      if (prevRow) setOutgoingAwaiting(prev => upsert(prev, prevRow));
      console.error(e);
      setErr(e.message || "Failed to deny request.");
    }
  };

  const acceptIncoming = async (reqId) => {
    setErr(null);
    const prevRow = incomingPending.find(r => r.id === reqId);
    // optimistic: remove from pending list
    setIncomingPending(prev => prev.filter(r => r.id !== reqId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", reqId)
        .eq("status", "pending");
      if (error) throw error;

      // NOTE: your app should also create rows in public.friends when the child/their parent accepts.
      await refreshLists(childIds);
    } catch (e) {
      if (prevRow) setIncomingPending(prev => upsert(prev, prevRow));
      console.error(e);
      setErr(e.message || "Failed to accept incoming request.");
    }
  };

  const declineIncoming = async (reqId) => {
    setErr(null);
    const prevRow = incomingPending.find(r => r.id === reqId);
    setIncomingPending(prev => prev.filter(r => r.id !== reqId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "denied" })
        .eq("id", reqId)
        .eq("status", "pending");
      if (error) throw error;

      await refreshLists(childIds);
    } catch (e) {
      if (prevRow) setIncomingPending(prev => upsert(prev, prevRow));
      console.error(e);
      setErr(e.message || "Failed to decline incoming request.");
    }
  };

  // -------- helpers --------
  const refreshLists = async (ids) => {
    if (!ids?.length) return;
    try {
      const [{ data: outR }, { data: inR }] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, requester_id, addressee_id, status, created_at")
          .in("requester_id", ids)
          .eq("status", "awaiting_parent")
          .order("created_at", { ascending: true }),
        supabase
          .from("friend_requests")
          .select("id, requester_id, addressee_id, status, created_at")
          .in("addressee_id", ids)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);
      setOutgoingAwaiting(outR || []);
      setIncomingPending(inR || []);
    } catch (e) {
      console.error("refreshLists error", e);
      setErr(e.message || "Failed to refresh lists.");
    }
  };

  const reset = () => { setChildren([]); setOutgoingAwaiting([]); setIncomingPending([]); setLoading(false); };
  const nameFor = (id) => children.find(c => c.player_id === id)?.name || `Player ${id}`;
  const upsert = (list, row) => {
    const i = list.findIndex(x => x.id === row.id);
    if (i === -1) return [...list, row].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const next = list.slice(); next[i] = row; return next;
  };

  // ---- UI ----
  return (
    <div className="max-w-5xl mx-auto p-4 text-white">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chat Approvals</h1>
          <p className="text-sm text-gray-400">Signed in as {meEmail || "—"}</p>
        </div>
      </div>

      {/* DEBUG: remove when happy */}
      <div className="mb-3 text-xs text-gray-400">
        children: {JSON.stringify(children.map(c => c.player_id))} &nbsp;|&nbsp;
        outgoingAwaiting: {outgoingAwaiting.length} &nbsp;|&nbsp;
        incomingPending: {incomingPending.length}
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200 p-3 text-sm">
          {String(err)}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : children.length === 0 ? (
        <div className="text-yellow-400">No linked players for this parent account.</div>
      ) : (
        <div className="space-y-8">
          {children.map((ch) => (
            <div key={ch.player_id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{ch.name}</div>
                  <div className="text-xs text-gray-400">Player #{ch.player_id}</div>
                </div>
                <button
                  onClick={() => toggleGlobalChat(ch.player_id, ch.parent_verified)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${ch.parent_verified ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"}`}
                >
                  {ch.parent_verified ? "Chat enabled ✓" : "Enable chat"}
                </button>
              </div>

              {/* Outgoing requests awaiting parent approval */}
              <Section title="Requests your child wants to send (awaiting your approval)">
                <List
                  rows={outgoingAwaiting.filter(r => r.requester_id === ch.player_id)}
                  empty="No pending approvals."
                  render={(r) => (
                    <Row
                      key={r.id}
                      left={`To: ${nameFor(r.addressee_id)}`}
                      meta={new Date(r.created_at).toLocaleString()}
                    >
                      <Btn onClick={() => approveOutgoing(r.id)} variant="ok">Approve</Btn>
                      <Btn onClick={() => denyOutgoing(r.id)} variant="warn">Deny</Btn>
                    </Row>
                  )}
                />
              </Section>

              {/* Incoming requests to the child (parent can act on child's behalf) */}
              <Section title="Requests sent to your child (you can act on their behalf)">
                <List
                  rows={incomingPending.filter(r => r.addressee_id === ch.player_id)}
                  empty="No incoming requests."
                  render={(r) => (
                    <Row
                      key={r.id}
                      left={`From: ${nameFor(r.requester_id)}`}
                      meta={new Date(r.created_at).toLocaleString()}
                    >
                      <Btn onClick={() => acceptIncoming(r.id)} variant="ok">Accept</Btn>
                      <Btn onClick={() => declineIncoming(r.id)} variant="warn">Decline</Btn>
                    </Row>
                  )}
                />
              </Section>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-base mb-2">{title}</h3>
      {children}
    </div>
  );
}

function List({ rows, render, empty }) {
  if (!rows || !rows.length) return <div className="text-sm text-gray-400">{empty}</div>;
  return <ul className="space-y-2">{rows.map(render)}</ul>;
}

function Row({ left, meta, children }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
      <div>
        <div className="text-sm">{left}</div>
        <div className="text-xs text-gray-400">{meta}</div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </li>
  );
}

function Btn({ onClick, children, variant }) {
  const cls = variant === "ok"
    ? "px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-sm"
    : "px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-sm";
  return <button onClick={onClick} className={cls}>{children}</button>;
}
