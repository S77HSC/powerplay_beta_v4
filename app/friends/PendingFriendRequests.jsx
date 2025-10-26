"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PendingFriendRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);

  async function load(uid) {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status, created_at")
      .eq("status", "pending")
      .eq("friend_id", uid)
      .order("created_at", { ascending: false });

    if (error) { setErr(error.message); setLoading(false); return; }

    const senderIds = [...new Set((data ?? []).map(r => r.user_id))];
    let byId = {};
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds);
      byId = Object.fromEntries((profs ?? []).map(p => [p.id, p]));
    }

    setRows((data ?? []).map(r => ({ ...r, sender: byId[r.user_id] || null })));
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("Not signed in"); setLoading(false); return; }
      setMe(user.id);
      await load(user.id);

      const ch = supabase.channel("incoming-friends")
        .on("postgres_changes",
            { event: "*", schema: "public", table: "friends", filter: `friend_id=eq.${user.id}` },
            () => load(user.id))
        .subscribe();
      return () => supabase.removeChannel(ch);
    })();
  }, []);

  async function updateStatus(id, status) {
    const { error } = await supabase.from("friends").update({ status }).eq("id", id);
    if (error) setErr(error.message);
    else setRows(prev => prev.filter(r => r.id !== id));
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!rows.length) return <div className="text-sm text-gray-600">No pending requests.</div>;

  return (
    <ul className="divide-y">
      {rows.map(r => (
        <li key={r.id} className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="font-medium">{r.sender?.username || r.user_id.slice(0,8)}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-black text-white" onClick={() => updateStatus(r.id, "accepted")}>Accept</button>
            <button className="px-3 py-1 rounded border" onClick={() => updateStatus(r.id, "declined")}>Decline</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
