"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  // Try to detect a recovery session created by the email link.
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) setReady(true);
      setChecking(false);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const recheck = async () => {
    setChecking(true);
    setError("");
    const { data } = await supabase.auth.getSession();
    if (data?.session) setReady(true);
    else setError("Still not seeing a recovery session. Please reopen the link from your email.");
    setChecking(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updErr) {
      setError(updErr.message || "Couldn't update password.");
      return;
    }

    setMessage("Your password has been updated. You can now log in.");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-100">
      {/* optional background like login */}
      {/* <video autoPlay muted loop className="absolute inset-0 w-full h-full object-cover">
        <source src="/videos/powerplay-login-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/60" /> */}

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
        <img src="/powerplay-logo.png" alt="PowerPlay Soccer" className="h-20 w-auto" />
      </div>

      <div className="relative z-20 w-full max-w-md bg-white rounded-2xl shadow p-6 m-6">
        <h1 className="text-2xl font-semibold mb-2">Reset password</h1>
        <p className="text-sm text-gray-600 mb-6">
          {ready
            ? "Enter your new password below."
            : "Open the link from your email on this device to continue."}
        </p>

        {!ready && (
          <div className="mb-4 text-xs text-gray-500">
            Tip: Make sure the email link opens in the same browser where you requested it,
            and that the URL points to your current environment (localhost or your live site).
          </div>
        )}

        {!ready && (
          <button
            type="button"
            onClick={recheck}
            disabled={checking}
            className="mb-4 w-full rounded bg-gray-200 py-2 disabled:opacity-50"
          >
            {checking ? "Checking..." : "I clicked the email link — try again"}
          </button>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!ready}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!ready}
          />
          {error && <div className="text-red-600 text-sm">❌ {error}</div>}
          {message && <div className="text-green-600 text-sm">✅ {message}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
            disabled={!ready}
          >
            Update password
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
