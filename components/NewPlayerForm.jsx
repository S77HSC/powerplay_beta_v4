
"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function NewPlayerForm() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [points, setPoints] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !team) {
      alert("Please enter both player name and team.");
      return;
    }

    const { error } = await supabase.from("players").insert([
      {
        name,
        team,
        points: parseInt(points),
      },
    ]);

    if (error) {
      console.error("Insert error:", error.message);
      alert("Failed to add player.");
    } else {
      setSuccessMessage("✅ Player added successfully!");
      setName("");
      setTeam("");
      setPoints(0);

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
      <h2>Add New Player</h2>
      <input
        type="text"
        placeholder="Player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: "8px", marginRight: "8px" }}
      />
      <input
        type="text"
        placeholder="Team name"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        style={{ padding: "8px", marginRight: "8px" }}
      />
      <input
        type="number"
        placeholder="Points"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        style={{ padding: "8px", marginRight: "8px", width: "80px" }}
      />
      <button type="submit" style={{ padding: "8px 12px" }}>
        Add Player
      </button>
      {successMessage && <div style={{ marginTop: "8px", color: "green" }}>{successMessage}</div>}
    </form>
  );
}
