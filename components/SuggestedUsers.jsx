"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import FollowButton from "./FollowButton";

export default function SuggestedUsers({ userId }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data: all } = await supabase
        .from("profiles")
        .select("id, username, avatar_url");

      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followingIds = following.map(f => f.following_id);

      const suggestions = all.filter(
        (u) => u.id !== userId && !followingIds.includes(u.id)
      );

      setUsers(suggestions.slice(0, 5)); // limit
    };

    if (userId) fetchSuggestions();
  }, [userId]);

  return (
    <div className="bg-gray-800 p-4 rounded-xl space-y-2">
      <h3 className="text-yellow-400 font-semibold mb-2">Suggested Users</h3>
      {users.map((u) => (
        <div key={u.id} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={u.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full" />
            <span>{u.username}</span>
          </div>
          <FollowButton userId={userId} targetId={u.id} />
        </div>
      ))}
    </div>
  );
}
