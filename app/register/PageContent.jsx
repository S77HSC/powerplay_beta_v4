"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const role = searchParams.get("role") || "player";

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the terms and privacy policy.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/complete-profile?role=${role}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      alert("Check your inbox to confirm your email address.");
      router.push("/login");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: "url('/images/game_zone_background.png')" }}
    >
      <div className="bg-black bg-opacity-80 p-8 rounded-xl shadow-xl max-w-md w-full text-white">
        <img
          src="/logo.png"
          alt="PowerPlay Logo"
          className="mx-auto mb-6 w-32 h-auto"
        />
        <h1 className="text-2xl font-bold text-center mb-4">Create an Account</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            required
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <select
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
            value={role}
            disabled
          >
            <option value="player">Player</option>
            <option value="coach">Coach</option>
            <option value="parent">Parent</option>
          </select>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
            />
            <span>
              I agree to the{" "}
              <a href="#" className="text-cyan-400">
                Terms of Use
              </a>{" "}
              and{" "}
              <a href="#" className="text-cyan-400">
                Privacy Policy
              </a>.
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded font-semibold"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </form>
        <div className="text-center mt-4">
          <p>
            Already have an account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
