// components/GearTabs.jsx

export default function GearTabs({ activeTab, setActiveTab }) {
  const tabs = ["kits", "boots", "badges", "celebrations", "footballs", "accessories"];

  const tabLabels = {
    kits: "Kits",
    boots: "Boots",
    badges: "Badges",
    celebrations: "Celebrations",
    footballs: "Footballs",
    accessories: "Accessories",
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 rounded font-semibold text-sm uppercase tracking-wide transition ${
            activeTab === tab
              ? "bg-yellow-400 text-black"
              : "bg-gray-800 text-white hover:bg-yellow-600"
          }`}
        >
          {tabLabels[tab]}
        </button>
      ))}
    </div>
  );
}

