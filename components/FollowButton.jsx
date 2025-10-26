"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function FollowButton({ userId, targetId }) {
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const checkFollowing = async () => {
      const { data } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", userId)
        .eq("following_id", targetId)
        .single();

      setIsFollowing(!!data);
    };

    if (userId && targetId && userId !== targetId) {
      checkFollowing();
    }
  }, [userId, targetId]);

  const toggleFollow = async () => {
    if (!userId || !targetId || userId === targetId) return;

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", targetId);
      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({
        follower_id: userId,
        following_id: targetId,
      });
      setIsFollowing(true);
    }
  };

  if (userId === targetId) return null;

  return (
    <button
      onClick={toggleFollow}
      className={\`px-3 py-1 text-sm rounded font-semibold \${isFollowing ? "bg-gray-500 text-white" : "bg-yellow-400 text-black"}\`}
    >
      {isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}
