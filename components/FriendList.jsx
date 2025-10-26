"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FriendList({ userId }) {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    const fetchFriends = async () => {
      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId);

      const followingIds = following.map(f => f.following_id);
      const followerIds = followers.map(f => f.follower_id);
      const mutuals = followingIds.filter(id => followerIds.includes(id));

      if (mutuals.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", mutuals);
        setFriends(profiles);
      }
    };

    if (userId) fetchFriends();
  }, [userId]);

  return (
    <div className="space-y-2">
      {friends.map(f => (
        <div key={f.id} className="flex items-center gap-2">
          <img src={f.avatar_url || '/default-avatar.png'} alt="" className="w-6 h-6 rounded-full" />
          <span>{f.username}</span>
        </div>
      ))}
    </div>
  );
}
