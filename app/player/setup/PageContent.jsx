"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function CompleteProfile() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "player";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    age: "",
    country: "",
    avatar_url: ""
  });

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user || !user.email_confirmed_at) {
        router.push("/login");
        return;
      }

      setUser(user);
      setForm((prev) => ({ ...prev, name: user.email.split("@")[0] }));
      setLoading(false);
    };

    getUser();
  }, [router]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const { data: existing, error: fetchError } = await supabase
      .from("players")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing player:", fetchError.message);
      return;
    }

    let avatar_url = form.avatar_url;

    const updateData = {
      name: form.name,
      age: form.age,
      country: form.country,
      avatar_url,
      auth_id: user.id,
      role: role // Ensure role is stored with the player
    };

    let player;
    if (existing) {
      const { data, error } = await supabase
        .from("players")
        .update(updateData)
        .eq("auth_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating player:", error.message);
        return;
      }

      player = data;
    } else {
      const { data, error } = await supabase
        .from("players")
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.error("Error inserting player:", error.message);
        return;
      }

      player = data;
    }

    if (player?.id) {
      router.push(`/player/${player.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Name"
          required
          className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
          value={form.name}
          onChange={handleChange}
        />
        <input
          type="number"
          name="age"
          placeholder="Age"
          className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
          value={form.age}
          onChange={handleChange}
        />
        <input
          type="text"
          name="country"
          placeholder="Country"
          required
          className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
          value={form.country}
          onChange={handleChange}
        />
        <button
          type="submit"
          className="w-full bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded font-semibold"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}
