"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function FriendFinder({ me }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [err, setErr] = useState(null);
  const [pendingIds, setPendingIds] = useState(new Set());

  async function searchPeople(q) {
    setErr(null);
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const [p1, p2] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${q}%`)
        .limit(10),
      supabase
        .from("players")
        .select("id, name, auth_id") // auth_id should be users.id (UUID)
        .ilike("name", `%${q}%`)
        .limit(10),
    ]);

    if (p1.error) return setErr(p1.error.message);
    if (p2.error) return setErr(p2.error.message);

    const byProfile = (p1.data ?? []).map((r) => ({
      key: `profile:${r.id}`,
      label: r.username,
      targetUserId: r.id,
      source: "profile",
    }));

    const byPlayer = (p2.data ?? []).map((r) => ({
      key: `player:${r.id}`,
      label: r.name,
      targetUserId: r.auth_id, // null if not linked to account
      source: "player",
      unlinked: !r.auth_id,
    }));

    // de-dupe by target user id (fallback to key for unlinked)
    const seen = new Set();
    const merged = [...byProfile, ...byPlayer].filter((item) => {
      const k = item.targetUserId || item.key;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    setResults(merged);
  }

  // simple debounce
  function onChange(e) {
    const v = e.target.value;
    setTerm(v);
    clearTimeout(window.__ff_to);
    window.__ff_to = setTimeout(() => searchPeople(v), 250);
  }

  async function sendRequest(targetUserId) {
    setErr(null);
    if (!targetUserId) {
      setErr("That player isn’t linked to a user account yet.");
      return;
    }

    setPendingIds((prev) => new Set(prev).add(targetUserId));

    // If your RLS requires 'created_by', add created_by: me here.
    const { error } = await supabase.from("friends").insert({
      user_id: me,
      friend_id: targetUserId,
      status: "pending",
    });

    setPendingIds((prev) => {
      const s = new Set(prev);
      s.delete(targetUserId);
      return s;
    });

    if (error) setErr(error.message);
  }

  return (
    <div className="space-y-3">
      <input
        value={term}
        onChange={onChange}
        placeholder="Search username or player name…"
        className="w-full border rounded px-3 py-2"
      />

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="space-y-2">
        {results.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between border rounded px-3 py-2"
          >
            <div>
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-gray-500">
                {r.source === "profile" ? "Profile" : "Player"}
              </div>
            </div>
            <button
              disabled={!r.targetUserId || pendingIds.has(r.targetUserId)}
              onClick={() => sendRequest(r.targetUserId)}
              className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
            >
              {r.unlinked
                ? "Unlinked"
                : pendingIds.has(r.targetUserId)
                ? "Sending…"
                : "Add"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
