"use client";
import Link from "next/link";

export default function GameZonePage() {
  const games = [
    // 🔥 New tile — Reaction Rush
    {
      name: "Reaction Rush",
      description:
        "Collect, dodge, freeze — beat the clock. Includes Realism (beta).",
      image: "/reaction-rush/rr-hero.png",
      icon: "/reaction-rush/rr-icon.png",
      link: "/reaction-rush",
      status: "live",
      badge: "NEW",
    },

    // existing tiles…
    {
      name: "PowerPlay",
      description: "High-stakes strategy. Trigger power moves and manage chaos.",
      image: "/powerplay-logo.png",
      link: "/powerplay",
      status: "live",
    },
    {
      name: "Sacrifice (Survivor Mode)",
      description:
        "Score to survive — but lose a teammate in return. Brutal, tactical, thrilling.",
      image: "/sacrifice_logo.png",
      link: "/survivor_mode",
      status: "live",
    },
    {
      name: "Competitions (League & Cup)",
      description:
        "Compete in structured seasons, climb divisions, and rule the leaderboard.",
      image: "/tournament-sparkle.png",
      link: "/sacrifice-league/new",
      status: "live",
    },
    {
      name: "BoostBall",
      description:
        "Real football. Supercharged. A high-intensity experience — launching soon.",
      image: "/boostball_logo.png",
      link: "#",
      status: "coming-soon",
    },
  ];

  return (
    <main className="min-h-screen p-10 text-white bg-gradient-to-br from-black to-gray-800">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-10 gap-2">
        <h1 className="text-4xl font-bold uppercase tracking-wide text-white">
          Game Zone
        </h1>
        <p className="text-lg text-gray-300">
          Play immersive modes that mirror real-life matchups. Choose your
          challenge and earn XP.
        </p>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div
            key={game.name}
            className={`relative group rounded-xl border ${
              game.status === "coming-soon"
                ? "border-gray-600 opacity-60 cursor-not-allowed"
                : "border-yellow-500 hover:border-yellow-400 hover:scale-[1.01]"
            } transition-transform duration-200 overflow-hidden min-h-[300px] shadow-md`}
          >
            {/* Background Image */}
            <img
              src={game.image}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10" />

            {/* Top-right badge */}
            {game.badge && (
              <div className="absolute z-20 top-3 right-3 bg-green-400 text-black text-xs font-extrabold px-2.5 py-1 rounded-full shadow">
                {game.badge}
              </div>
            )}

            {/* Small app icon (top-left) */}
            {game.icon && (
              <img
                src={game.icon}
                alt=""
                className="absolute z-20 top-3 left-3 w-9 h-9 rounded-md shadow-md border border-white/20"
              />
            )}

            {/* Foreground Content */}
            <div className="relative z-20 p-6 flex flex-col h-full justify-between">
              <div>
                <h2 className="text-2xl font-extrabold uppercase text-white drop-shadow-md mb-2">
                  {game.name}
                </h2>
                <p className="text-sm text-gray-200">{game.description}</p>
              </div>

              <div className="mt-4">
                {game.status === "live" ? (
                  <Link
                    href={game.link}
                    className="inline-flex items-center gap-2 bg-yellow-400 text-black font-bold px-4 py-1.5 rounded-full text-sm hover:bg-yellow-300 transition"
                  >
                    <span>▶</span> Play Now
                  </Link>
                ) : (
                  <span className="inline-block bg-gray-600 text-white font-bold px-4 py-1.5 rounded-full text-sm">
                    🚧 Coming Soon
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
