"use client";
export default function MobileTabs({ tab, setTab }) {
  const tabs = [
    { key: "feed", label: "Feed" },
    { key: "chat", label: "Chat" },
    { key: "followers", label: "Followers" },
  ];

  return (
    <div className="flex bg-gray-800 rounded-lg overflow-hidden">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`flex-1 py-2 text-sm font-bold ${tab === t.key ? "text-yellow-400" : "text-gray-400"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
