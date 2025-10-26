// app/skill-player/loading.jsx
export default function Loading() {
  return (
    <main className="min-h-[70vh] grid place-items-center bg-[#050c12] text-white">
      <div className="relative">
        {/* glow ring */}
        <div className="absolute -inset-8 rounded-3xl opacity-40 blur-2xl
                        bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-blue-500" />
        <div className="relative z-10 flex flex-col items-center gap-3
                        rounded-2xl border border-white/10 bg-black/50 px-8 py-6">
          {/* spinner */}
          <div className="h-10 w-10 animate-spin rounded-full border-2
                          border-white/20 border-t-white/80" />
          <div className="text-sm text-white/80 tracking-wide">
            Loading your session…
          </div>
        </div>
      </div>
    </main>
  );
}
