"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MessageNotifications() {
  const [lastMsg, setLastMsg] = useState(null);

  useEffect(() => {
    let unsub;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ask for browser notification permission (optional)
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }

      const ch = supabase
        .channel("message-inbox")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
          (payload) => {
            setLastMsg(payload.new);
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("New message", { body: (payload.new.text || "").slice(0, 80) });
            }
          }
        )
        .subscribe();

      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
  }, []);

  if (!lastMsg) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded shadow">
      New message: {(lastMsg.text || "").slice(0, 80)}
    </div>
  );
}
