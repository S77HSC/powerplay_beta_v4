"use client";
import { useState } from "react";
import { supabase } from "./supabaseClient"; // adjust path if you keep client elsewhere

export default function ClaimWeeklyButton({ playerId, onReveal }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onClick() {
    try {
      setLoading(true);
      setMsg(null);

      // invokes /supabase/functions/claim-weekly/index.ts
      const { data, error } = await supabase.functions.invoke("claim-weekly", {
        body: { playerId } // for historical tests add: , asOf: "2025-05-24T12:00:00Z"
      });

      if (error) throw error;
      if (data?.alreadyClaimed) {
        setMsg("Already claimed for this week.");
        return;
      }

      // hand new cards to your reveal animation
      onReveal?.(data?.cards || [], data?.dustAwarded || 0);
      setMsg(`Claimed ${data?.tier?.toUpperCase()} weekly reward!`);
    } catch (e) {
      setMsg(e?.message || "Claim failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black disabled:opacity-60"
      >
        {loading ? "Claiming..." : "🎁 Claim Weekly"}
      </button>
      {msg && <span className="text-sm opacity-80">{msg}</span>}
    </div>
  );
}
