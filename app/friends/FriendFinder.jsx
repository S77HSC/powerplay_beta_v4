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
    if (!q.trim()) return setResults([]);

    const [p1, p2] = await Promise.all([
      supabase.from("profiles").select("id, username").ilike("username", `%${q}%`).limit(15),
      supabase.from("players").select("id, name, auth_id").ilike("name", `%${q}%`).limit(20),
    ]);
    if (p1.error) return setErr(p1.error.message);
    if (p2.error) return setErr(p2.error.message);

    const fromProfiles = (p1.data ?? []).map((r) => ({
      key: `profile:${r.id}`,
      label: r.username || "(no username)",
      targetUserId: r.id, // may or may not be auth id; we guard on insert
      source: "Profile",
    }));

    const seenPlayerAuths = new Set();
    const fromPlayers = (p2.data ?? [])
      .filter((r) => !!r.auth_id)
      .filter((r) => {
        if (seenPlayerAuths.has(r.auth_id)) return false;
        seenPlayerAuths.add(r.auth_id);
        return true;
      })
      .map((r) => ({
        key: `player:${r.id}`,
        label: r.name || "(no name)",
        targetUserId: r.auth_id, // valid auth.users UUID
        source: "Player",
      }));

    const seenFinal = new Set();
    const merged = [...fromProfiles, ...fromPlayers].filter((item) => {
      const k = item.targetUserId || item.key;
      if (seenFinal.has(k)) return false;
      seenFinal.add(k);
      return true;
    });

    setResults(merged);
  }

  function onChange(e) {
    const v = e.target.value;
    setTerm(v);
    clearTimeout(window.__ff_to);
    window.__ff_to = setTimeout(() => searchPeople(v), 250);
  }

  async function sendRequest(targetUserId, source) {
    setErr(null);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || me !== authUser.id) {
      setErr("Session mismatch — reload/sign in.");
      return;
    }
    if (!targetUserId) {
      setErr(source === "Player" ? "This player isn’t linked to a real account." : "This profile isn’t a registered account.");
      return;
    }
    if (targetUserId === me) {
      setErr("You can’t friend yourself.");
      return;
    }

    // Duplicate guard: any pending/accepted either direction
    const { data: existing, error: exErr } = await supabase
      .from("friends")
      .select("id,status")
      .or(`and(user_id.eq.${me},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${me})`)
      .in("status", ["pending", "accepted"])
      .limit(1);
    if (exErr) { setErr(exErr.message); return; }
    if (existing?.length) {
      setErr("There is already a request between you two.");
      return;
    }

    setPendingIds((prev) => new Set(prev).add(targetUserId));

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

    if (error?.code === "23503") setErr("That account isn’t a registered user.");
    else if (error) setErr(error.message);
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
        {results.map((r) => {
          const disableAdd =
            !r.targetUserId || pendingIds.has(r.targetUserId) || r.source === "Profile";
          return (
            <div key={r.key} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-gray-500">{r.source}</div>
              </div>
              <button
                disabled={disableAdd}
                onClick={() => sendRequest(r.targetUserId, r.source)}
                className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
                title={
                  r.source === "Profile"
                    ? "Profile results are view-only here. Use a Player with a linked account."
                    : !r.targetUserId
                    ? "This player isn’t linked to a real account."
                    : ""
                }
              >
                {r.source === "Profile" ? "View" :
                 !r.targetUserId ? "Unlinked" :
                 pendingIds.has(r.targetUserId) ? "Sending…" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
