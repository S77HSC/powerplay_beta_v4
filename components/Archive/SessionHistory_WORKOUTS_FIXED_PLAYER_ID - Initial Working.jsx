"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function SessionHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const fetchPlayerAndSessions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (!playerData) return;
      setPlayer(playerData);

      const { data: sessionsData, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("player_id", playerData.id)
        .order("completed_at", { ascending: false });

      if (!error) {
        setSessions(sessionsData);
      }
      setLoading(false);
    };

    fetchPlayerAndSessions();
  }, []);

  if (loading) return <p style={styles.loading}>Loading session history...</p>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Session History</h1>
      {sessions.length === 0 ? (
        <p style={styles.empty}>No sessions recorded yet.</p>
      ) : (
        <ul style={styles.list}>
          {sessions.map((session) => (
            <li key={session.id} style={styles.item}>
              <span style={styles.date}>
                {new Date(session.completed_at).toLocaleDateString()}
              </span>
              <span>XP: {session.xr_awarded}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#0A0F24",
    color: "#fff",
    minHeight: "100vh",
    padding: "2rem",
    fontFamily: "Arial, sans-serif",
  },
  title: {
    fontSize: "28px",
    marginBottom: "1rem",
    color: "#00b4d8",
  },
  loading: {
    color: "#aaa",
    padding: "1rem",
  },
  empty: {
    color: "#ccc",
    fontStyle: "italic",
  },
  list: {
    listStyle: "none",
    padding: 0,
  },
  item: {
    padding: "12px",
    marginBottom: "10px",
    backgroundColor: "#1a1f3c",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "8px",
  },
  date: {
    fontWeight: "bold",
    color: "#7dd3fc",
  },
};