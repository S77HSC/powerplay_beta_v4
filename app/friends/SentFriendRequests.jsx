"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SentFriendRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load(uid) {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status, created_at")
      .eq("status", "pending")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) { setErr(error.message); setLoading(false); return; }

    const friendIds = [...new Set((data ?? []).map(r => r.friend_id))];
    let byId = {};
    if (friendIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", friendIds);
      byId = Object.fromEntries((profs ?? []).map(p => [p.id, p]));
    }

    setRows((data ?? []).map(r => ({ ...r, friend: byId[r.friend_id] || null })));
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("Not signed in"); setLoading(false); return; }
      await load(user.id);

      const ch = supabase.channel("outgoing-friends")
        .on("postgres_changes",
            { event: "*", schema: "public", table: "friends", filter: `user_id=eq.${user.id}` },
            () => load(user.id))
        .subscribe();
      return () => supabase.removeChannel(ch);
    })();
  }, []);

  async function cancelRequest(id) {
    const { error } = await supabase.from("friends").delete().eq("id", id);
    if (error) setErr(error.message);
    else setRows(prev => prev.filter(r => r.id !== id));
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!rows.length) return <div className="text-sm text-gray-600">No sent requests.</div>;

  return (
    <ul className="divide-y">
      {rows.map(r => (
        <li key={r.id} className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="font-medium">{r.friend?.username || r.friend_id.slice(0,8)}</div>
          </div>
          <button className="px-3 py-1 rounded border" onClick={() => cancelRequest(r.id)}>
            Cancel
          </button>
        </li>
      ))}
    </ul>
  );
}
