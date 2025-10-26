"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";

export default function SocialFeed({ userId }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const loadFeed = async () => {
      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("user_id", userId)
        .eq("approved", true);

      const friendIds = friends?.map((f) => f.friend_id) || [];

      const { data: posts } = await supabase
        .from("posts")
        .select("*, user:auth.users(name, avatar_url)")
        .in("user_id", friendIds)
        .order("created_at", { ascending: false });

      setPosts(posts || []);
    };

    loadFeed();
  }, [userId]);

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div
          key={post.id}
          className="bg-[#1f2937] rounded-xl p-4 shadow space-y-2"
        >
          <div className="flex items-center gap-3">
            <Image
              src={post.user?.avatar_url || "/default-avatar.png"}
              alt={post.user?.name}
              width={36}
              height={36}
              className="rounded-full"
            />
            <div>
              <p className="font-semibold text-white">{post.user?.name}</p>
              <p className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <video
            src={post.video_url}
            controls
            className="w-full max-h-[360px] rounded-md bg-black"
          />

          <p className="text-white">{post.caption}</p>
          <p className="text-yellow-400 text-sm">Touches: {post.touch_count}</p>
          <div className="text-sm text-gray-300">❤️ 2 • 💬 1</div>
        </div>
      ))}
    </div>
  );
}

