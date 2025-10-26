// app/login/PageContent.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function PageContent() {
  const router = useRouter();

  // UI state
  const [role, setRole] = useState("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [exiting, setExiting] = useState(false); // fade-out flag

  // ---- helpers ----
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const getNextPath = () => {
    let nextPath = "/lobby";
    if (role === "coach") nextPath = "/coach-dashboard";
    if (role === "parent") nextPath = "/parent-dashboard";
    try {
      const ss = sessionStorage.getItem("nextAfterLogin");
      if (ss) nextPath = ss;
    } catch {}
    return nextPath;
  };
  const waitForClientSession = async (timeoutMs = 2500) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return data.session;
      await sleep(60);
    }
    return null;
  };

  // Prefetch launcher for faster handoff
  useEffect(() => {
    try {
      router.prefetch("/launch?next=/lobby");
    } catch {}
  }, [router]);

  // Seed a basic player profile if missing
  async function ensurePlayerBootstrap(user) {
    const { data: existing, error: readErr } = await supabase
      .from("players")
      .select("id, equipped_items")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (readErr && readErr.code !== "PGRST116") throw readErr;

    if (!existing) {
      const nickname = user.email?.split("@")[0] || "Player";
      const defaultEquipped = {
        equipped_card_id: "default_card",
        equip_config: { glow: true, shine: true },
        card: {
          name: "Player",
          rarity: "legendary",
          level: 1,
          overall: 60,
          position: "LW",
          avatarUrl: "/characters/striker_base.png",
          imageUrl: "/player-cards/d_beckham_legendary.png",
          stats: { pac: 60, sho: 55, pas: 58, dri: 57, def: 35, phy: 50 },
        },
      };
      const { error: insertErr } = await supabase.from("players").insert({
        name: nickname,
        auth_id: user.id,
        role: "player",
        chat_enabled: true,
        equipped_items: defaultEquipped,
      });
      if (insertErr) throw insertErr;
    }
  }

  // Fade the page to transparent, then navigate (no white/black frame)
  async function goToLaunch(nextPath) {
    setExiting(true); // triggers opacity transition on <main>
    await sleep(220); // allow the fade-out to complete
    router.replace(`/launch?next=${encodeURIComponent(nextPath || "/lobby")}`);
  }

  // User must submit to navigate (no auto-redirect on mount)

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setResetMsg("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !data?.user) throw new Error("Invalid email or password");

      const user = data.user;

      // route target + optional bootstrap
      let nextPath = "/lobby";
      if (role === "coach") nextPath = "/coach-dashboard";
      if (role === "parent") nextPath = "/parent-dashboard";
      if (role === "player") await ensurePlayerBootstrap(user);

      try {
        sessionStorage.setItem("nextAfterLogin", nextPath);
      } catch {}

      // keep page visible until session is ready
      await waitForClientSession(2500);

      await goToLaunch(nextPath);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not complete login.");
      setExiting(false);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    try {
      setError(null);
      setResetMsg("");
      if (!email) {
        setError("Enter your email above first.");
        return;
      }
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );
      if (resetErr) throw resetErr;
      setResetMsg(
        "If that email exists, we've sent a reset link. Check your inbox (and spam)."
      );
    } catch (e) {
      console.error(e);
      setError("Couldn't start password reset. Please try again.");
    }
  };

  return (
    <main
      className={`relative min-h-[100svh] w-full overflow-hidden bg-black text-white transition-opacity duration-200 ease-out ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Stadium background — z-0 so it's ABOVE body bg and visible */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/futuristic-stadium_b.png"
          alt=""
          className="h-full w-full object-cover select-none"
          draggable={false}
          decoding="async"
          fetchPriority="high"
        />
        {/* Subtle gradient + vignette for readability */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 10%, rgba(0,0,0,0) 0%, rgba(0,0,0,.35) 60%, rgba(0,0,0,.65) 100%)",
          }}
        />
      </div>

      {/* crest top-center */}
      <div className="pointer-events-none absolute left-0 right-0 top-6 z-40 grid place-items-center">
        <img
          src="/powerplay-logo.png"
          alt="PowerPlay crest"
          className="h-24 w-auto drop-shadow-[0_4px_30px_rgba(56,189,248,0.35)]"
          draggable={false}
        />
      </div>

      {/* Card */}
      <section className="relative z-20 mx-auto flex min-h-[100svh] max-w-6xl items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 text-black shadow-xl backdrop-blur">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Login</h2>

          <div className="mb-6 flex justify-center gap-6">
            {["player", "coach", "parent"].map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700"
              >
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
              className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && (
              <div className="text-center text-sm text-red-600">❌ {error}</div>
            )}
            {resetMsg && (
              <div className="text-center text-sm text-green-600">
                ✅ {resetMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Login"}
            </button>
          </form>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-gray-700">
            Don’t have an account{" "}
            <a href={`/register?role=${role}`} className="text-blue-600 hover:underline">
              Register as {role}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
