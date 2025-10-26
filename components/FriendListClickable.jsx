"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FriendListClickable({ userId, onSelect, activeId }) {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    const fetchFriends = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in(
          "id",
          (await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId)
          ).data.map((f) => f.following_id)
        );
      setFriends(data || []);
    };

    if (userId) fetchFriends();
  }, [userId]);

  return (
    <div className="space-y-2">
      {friends.map(f => (
        <div
          key={f.id}
          className={`flex items-center gap-2 p-2 rounded cursor-pointer ${activeId === f.id ? "bg-blue-600" : "hover:bg-gray-700"}`}
          onClick={() => onSelect(f.id)}
        >
          <img src={f.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full" />
          <span className="text-sm">{f.username}</span>
        </div>
      ))}
    </div>
  );
}
