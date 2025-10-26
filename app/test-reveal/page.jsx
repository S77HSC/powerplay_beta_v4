"use client";
import { useState } from "react";
import RewardRevealModal from "../../lobbycomponents/RewardRevealModal"; // <— key line

export default function TestRevealPage() {
  const [open, setOpen] = useState(false);
  const cards = [
    { card_id: 10, rarity: "legendary", name: "D. Beckman", image: "/player-cards/10.png" },
    { card_id: 3,  rarity: "rare",      name: "A. Iniesta", image: "/player-cards/3.png"  },
  ];

  return (
    <div className="min-h-screen grid place-items-center bg-black text-white">
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-yellow-400 px-6 py-2 text-black font-semibold"
      >
        Open Test Reveal
      </button>

      <RewardRevealModal
        open={open}
        title="Free Pick"
        cards={cards}
        dust={0}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
