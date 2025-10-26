"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FollowingList({ userId }) {
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    const fetchFollowing = async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (data.length > 0) {
        const ids = data.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        setFollowing(profiles || []);
      }
    };

    if (userId) fetchFollowing();
  }, [userId]);

  return (
    <div className="space-y-2">
      {following.map(f => (
        <div key={f.id} className="flex items-center gap-2">
          <img src={f.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full" />
          <span>{f.username}</span>
        </div>
      ))}
    </div>
  );
}
