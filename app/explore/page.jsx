"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ExplorePage() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url)")
        .order("created_at", { ascending: false });

      setPosts(data || []);
    };

    load();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-yellow-400 mb-4">Explore</h1>
      <div className="space-y-4">
        {posts.map(p => (
          <div key={p.id} className="bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <img src={p.profiles?.avatar_url || "/default-avatar.png"} className="w-6 h-6 rounded-full" />
              <span className="text-sm">{p.profiles?.username}</span>
            </div>
            {p.video_url && (
              <video controls className="w-full rounded-md max-h-[360px]">
                <source src={p.video_url} />
              </video>
            )}
            <p>{p.caption}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
