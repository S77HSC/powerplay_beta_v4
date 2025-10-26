"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FollowersList({ userId }) {
  const [followers, setFollowers] = useState([]);

  useEffect(() => {
    const fetchFollowers = async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId);

      if (data.length > 0) {
        const ids = data.map(f => f.follower_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        setFollowers(profiles || []);
      }
    };

    if (userId) fetchFollowers();
  }, [userId]);

  return (
    <div className="space-y-2">
      {followers.map(f => (
        <div key={f.id} className="flex items-center gap-2">
          <img src={f.avatar_url || '/default-avatar.png'} className="w-6 h-6 rounded-full" />
          <span>{f.username}</span>
        </div>
      ))}
    </div>
  );
}
