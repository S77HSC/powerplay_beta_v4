"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import GearTabs from "../../components/GearTabs";
import GearCard from "../../components/GearCard";
import CharacterBuilder from "../../components/CharacterBuilder";
import mockItems from "../../data/mockItems";
import Image from "next/image";
import Link from "next/link";
import "@fontsource/rajdhani/700.css";

export default function Page() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState("gear");
  const [activeTab, setActiveTab] = useState("kits");
  const [ownedItems, setOwnedItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (!playerData) return;

      setPlayer(playerData);

      const { data: items } = await supabase
        .from("player_items")
        .select("item_id")
        .eq("player_id", playerData.id);

      setOwnedItems(items?.map((item) => item.item_id) || []);
    };

    fetchData();
  }, []);

  const filteredItems =
    view === "store"
      ? mockItems[activeTab] || []
      : (mockItems[activeTab] || []).filter((item) =>
          ownedItems.includes(item.id)
        );

  const equippedGear = {
    kit: mockItems.kits.find((item) => ownedItems.includes(item.id)),
    boots: mockItems.boots.find((item) => ownedItems.includes(item.id)),
    accessory: mockItems.accessories.find((item) =>
      ownedItems.includes(item.id)
    ),
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19] text-white px-4 py-8 font-[Rajdhani] overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('images/locker_room_background.png')" }}
      ></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 uppercase tracking-wide">
            Locker Room
          </h1>
          <Link href="/">
            <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-yellow-600 transition font-bold uppercase text-sm">
              Back to Home
            </button>
          </Link>
        </div>

        <div className="text-center text-xl md:text-2xl text-yellow-300 font-extrabold mb-4">
          XP: {player?.points ?? 0}
        </div>

        <div className="flex flex-col-reverse md:flex-row gap-8">
          <div className="w-full md:w-[400px] flex justify-center mt-8 md:mt-0 order-first md:order-last">
            <CharacterBuilder gear={equippedGear} />
          </div>

          <div className="flex-1 order-last md:order-first">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setView("store")}
                className={`px-4 py-2 rounded text-sm font-bold uppercase transition ${
                  view === "store"
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-800 text-white hover:bg-yellow-600"
                }`}
              >
                Store
              </button>
              <button
                onClick={() => setView("gear")}
                className={`px-4 py-2 rounded text-sm font-bold uppercase transition ${
                  view === "gear"
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-800 text-white hover:bg-yellow-600"
                }`}
              >
                Your Gear
              </button>
            </div>

            <GearTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mt-6">
              {filteredItems.map((item) => (
                <GearCard
                  key={item.id}
                  item={item}
                  isOwned={ownedItems.includes(item.id)}
                  view={view}
                  player={player}
                  setOwnedItems={setOwnedItems}
                  selectedItem={selectedItem}
                  setSelectedItem={setSelectedItem}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedItem(null)}
        >
          <div className="max-w-3xl w-full relative">
            <img
              src={selectedItem.image}
              alt={selectedItem.name}
              className="w-full rounded-xl shadow-2xl transition-transform duration-500 ease-in-out transform hover:scale-105"
            />
            <button
              className="absolute top-2 right-2 text-white text-2xl font-bold"
              onClick={() => setSelectedItem(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}