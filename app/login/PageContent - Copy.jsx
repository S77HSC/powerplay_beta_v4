"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [role, setRole] = useState("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data?.user) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    const user = data.user;
    let profile = null;
    let profileError = null;

    if (role === "player") {
      ({ data: profile, error: profileError } = await supabase
        .from("players")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle());
    } else if (role === "coach") {
      ({ data: profile, error: profileError } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle());
    } else if (role === "parent") {
      ({ data: profile, error: profileError } = await supabase
        .from("parent_links")
        .select("id")
        .eq("parent_email", user.email)
        .maybeSingle());
    }

    const profileExists = !!profile?.id;

    if (!profileExists || profileError) {
      router.push(`/register?role=${role}`);
      setLoading(false);
      return;
    }

    if (role === "player") router.push("/homepage");
    else if (role === "coach") router.push("/coach-dashboard");
    else if (role === "parent") router.push("/parent-dashboard");

    setLoading(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30">
        <img src="/powerplay-logo.png" alt="PowerPlay Logo" className="h-28 w-auto" />
      </div>

      <div className="relative flex items-center justify-center min-h-screen bg-gray-900">
        <video
          autoPlay
          muted
          loop
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src="/videos/powerplay-login-bg.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-black bg-opacity-60 z-10" />

        <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-8 bg-white bg-opacity-95 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Login</h2>

          <div className="flex justify-center gap-6 mb-6">
            {["player", "coach", "parent"].map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                />
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </label>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 px-3 py-2 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 px-3 py-2 rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <div className="text-red-500 text-sm text-center">❌ {error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            >
              {loading ? "Please wait..." : "Login"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-700">
            Don’t have an account?{" "}
            <a href={`/register?role=${role}`} className="text-blue-600 hover:underline">
              Register as {role}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
