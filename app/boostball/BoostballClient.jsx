// app/boostball/BoostballClient.jsx
'use client';

export default function BoostballClient() {
  // Put your existing Boostball UI/logic here (hooks, effects, etc.)
  return (
    <main className="min-h-[60vh] p-6 text-white">
      <h1 className="text-2xl font-bold">Boostball</h1>
      <p className="mt-2 text-white/80">
        Client-rendered UI. Route options (revalidate/dynamic) are exported by the server page.
      </p>
    </main>
  );
}
