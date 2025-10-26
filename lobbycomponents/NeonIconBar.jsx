// lobbycomponents/NeonIconBar.jsx
"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase"; // ← adjust to ../../lib/supabase if needed

// Props:
// - className?: string
// - current?: string   (e.g. "notifications", "news", "home") to accent the active item
export default function NeonIconBar({ className = "", current = "" }) {
  const pathname = usePathname();

  // ---- Unread notifications badge ----
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    // 1) baseline from localStorage
    try {
      const n = Number(localStorage.getItem("notificationsUnread") || "0");
      if (mounted) setUnreadCount(Number.isFinite(n) ? n : 0);
    } catch {}

    // 2) best-effort head count from DB (if logged in)
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("player_auth_id", user.id)
          .eq("is_read", false);
        if (!error && mounted) setUnreadCount(count || 0);
      } catch {}
    })();

    // 3) live updates from notifications page via custom event
    const onUnread = (e) => {
      const val =
        typeof e?.detail !== "undefined"
          ? Number(e.detail || 0)
          : Number(localStorage.getItem("notificationsUnread") || "0");
      if (Number.isFinite(val)) setUnreadCount(Math.max(0, val));
    };
    window.addEventListener("notifications:unread", onUnread);

    return () => {
      mounted = false;
      window.removeEventListener("notifications:unread", onUnread);
    };
  }, []);

  // ---- Items config (badge only on notifications) ----
  const items = [
    { href: "/lobby",             label: "Home",          kind: "home",       from: "#22d3ee", to: "#3b82f6" },
    { href: "/locker",            label: "Store",         kind: "store",      from: "#a78bfa", to: "#f472b6" },
    { href: "/powerpass",         label: "Power Pass",    kind: "powerpass",  from: "#facc15", to: "#f97316" },
    { href: "/notifications",     label: "Notifications", kind: "bell",       from: "#fb7185", to: "#f59e0b", badge: unreadCount },
    { href: "/friends",           label: "Friends",       kind: "friends",    from: "#22d3ee", to: "#22c55e" },
    { href: "/map",               label: "Map",           kind: "map",        from: "#84cc16", to: "#10b981" },
    { href: "/live-news",         label: "News",          kind: "news",       from: "#60a5fa", to: "#22d3ee" },
    { href: "/leaderboard",       label: "World",         kind: "trophy",     from: "#f59e0b", to: "#f97316" },
    { href: "/player-dashboard",  label: "Profile",       kind: "user",       from: "#a78bfa", to: "#22c55e" },
    { href: "/settings",          label: "Settings",      kind: "cog",        from: "#eab308", to: "#f97316" },
    { kind: "logout",             label: "Logout",                          from: "#f87171", to: "#ef4444" },
  ];

  return (
    <nav
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md ${className}`}
      aria-label="Primary"
    >
      {items.map((it) =>
        it.kind === "logout" ? (
          <LogoutButton key="logout" {...it} />
        ) : (
          <IconButton
            key={it.label}
            {...it}
            active={
              current?.toLowerCase() === it.kind ||
              pathname === it.href
            }
          />
        )
      )}
    </nav>
  );
}

/* ------------------------------------------------------- */
/* Buttons                                                 */
/* ------------------------------------------------------- */

function IconButton({ href, label, kind, from, to, active = false, badge = 0 }) {
  const gid = useId();

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`group relative grid h-10 w-10 place-items-center sm:h-12 sm:w-12 ${
        active ? "scale-105" : ""
      }`}
    >
      {/* neon glow */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-1 -z-10 rounded-xl blur-lg opacity-60 transition-opacity duration-300 group-hover:opacity-90 ${
          active ? "opacity-90" : ""
        }`}
        style={{ background: `linear-gradient(45deg, ${from}, ${to})` }}
      />

      {/* ---- TILE becomes the positioning context ---- */}
      <span
        className={`relative grid h-full w-full place-items-center rounded-xl border bg-[#0b1020cc] shadow-[inset_0_0_18px_rgba(255,255,255,0.06),0_6px_20px_rgba(0,0,0,0.45)] transition-all duration-200 group-hover:scale-110 group-active:scale-95 group-hover:-rotate-[2deg] ${
          active ? "border-cyan-300/60" : "border-white/10"
        }`}
      >
        <IconSVG kind={kind} gid={gid} from={from} to={to} />

        {/* 🔔 Corner badge pinned to the TILE (top-right) */}
        {(kind === "bell" || kind === "messages") && badge > 0 && (
          <span
            className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3
                       grid min-w-[18px] place-items-center rounded-full
                       bg-red-500 px-1.5 text-[10px] font-bold text-white
                       ring-2 ring-black leading-none z-10"
            style={{ lineHeight: 1 }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
    </Link>
  );
}


function LogoutButton({ label, from, to }) {
  const router = useRouter();
  const gid = useId();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      aria-label={label}
      title={label}
      className="group relative grid h-10 w-10 place-items-center sm:h-12 sm:w-12"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-xl blur-lg opacity-60 transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `linear-gradient(45deg, ${from}, ${to})` }}
      />
      <span className="grid h-full w-full place-items-center rounded-xl border border-white/10 bg-[#0b1020cc] shadow-[inset_0_0_18px_rgba(255,255,255,0.06),0_6px_20px_rgba(0,0,0,0.45)] transition-all duration-200 group-hover:scale-110 group-active:scale-95 group-hover:-rotate-[2deg]">
        <IconSVG kind="logout" gid={gid} from={from} to={to} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------- */
/* Icons (SVG with gradient fill)                          */
/* ------------------------------------------------------- */

function IconSVG({ kind, gid, from, to }) {
  const Grad = () => (
    <defs>
      <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
    </defs>
  );

  switch (kind) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M4 11 12 4l8 7v8a2 2 0 0 1-2 2h-4v-6h-4v6H6a2 2 0 0 1-2-2v-8Z" />
          <path d="M2.5 12 12 4l9.5 8" fill="none" />
        </svg>
      );
    case "store":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M7 7V6a5 5 0 0 1 10 0v1" fill="none" />
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M9 12h6M9 16h6" strokeWidth="2.2" />
        </svg>
      );
    case "powerpass":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M12 2.7l6.5 3.75V17.6L12 21.3 5.5 17.6V6.45L12 2.7Z" />
          <path d="M13.2 5.8 8.9 12.6h3.2l-1.3 5.6 4.2-6.8h-3.1l1.3-5.6Z" />
        </svg>
      );
    case "bell": // Notifications
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M6 17h12l-1.2-1.8A6 6 0 0 1 16 11V9a4 4 0 1 0-8 0v2a6 6 0 0 1-.8 4.2L6 17Z" />
          <circle cx="12" cy="19.5" r="1.6" />
        </svg>
      );
    case "friends":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <circle cx="9" cy="9" r="3.5" />
          <path d="M3.5 20a6.5 6.5 0 0 1 11 0" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M14 18a5.5 5.5 0 0 1 6.5 0" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
          <circle cx="12" cy="11" r="2.5" />
          <path d="M12 13.5V17" />
        </svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <rect x="6" y="8" width="6" height="4" rx="1" />
          <path d="M13.5 9h4M13.5 12h4M6 14.5h11.5M6 17h11.5" strokeWidth="2.1" />
        </svg>
      );
    case "trophy":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M6 5h12v2a4 4 0 0 1-4 4h-4A4 4 0 0 1 6 7V5Z" />
          <path d="M6 7H5a3 3 0 0 0 3 3" fill="none" />
          <path d="M18 7h1a3 3 0 0 1-3 3" fill="none" />
          <path d="M10 11v2a2 2 0 0 0 4 0v-2" />
          <path d="M9 19h6M10 17h4" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a7.5 7.5 0 0 1 16 0" />
        </svg>
      );
    case "cog":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M12 2l1.2 2.5 2.8.5-.9 2.6 1.8 2-1.8 2 .9 2.6-2.8.5L12 22l-1.2-2.5-2.8-.5.9-2.6-1.8-2 1.8-2-.9-2.6 2.8-.5L12 2Z" />
          <circle cx="12" cy="12" r="3.25" fill="#0b1324" opacity="0.35" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" width="26" height="26" fill={`url(#g-${gid})`} stroke="#0a0a0a" strokeWidth="2">
          <Grad />
          <path d="M10 17l5-5-5-5M20 12H10M14 19v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
        </svg>
      );
    default:
      return null;
  }
}
