'use client';

import React from 'react';

const GearCard = ({ item, isUnlocked = false, onUnlock }) => {
  return (
    <div className="bg-white/10 p-4 rounded-xl text-center shadow hover:bg-white/5 transition">
      <img
        src={item.image}
        alt={item.name}
        className="h-24 mx-auto mb-3 object-contain drop-shadow"
      />
      <h3 className="text-sm font-bold text-white mb-1">{item.name}</h3>
      {!isUnlocked ? (
        <>
          <p className="text-xs text-pink-300">Unlock for {item.xp} XP</p>
          <button
            onClick={() => onUnlock(item)}
            className="mt-2 px-3 py-1 text-sm bg-pink-600 rounded hover:bg-pink-500"
          >
            Unlock
          </button>
        </>
      ) : (
        <div className="mt-2 text-xs text-green-400 font-semibold">Unlocked ✅</div>
      )}
    </div>
  );
};

export default GearCard;
