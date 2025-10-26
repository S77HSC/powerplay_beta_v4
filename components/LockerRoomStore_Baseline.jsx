'use client';

import React from 'react';
import GearCard from './GearCard';

const LockerRoomStore = ({ playerId, activeTab, items = [] }) => {
  const handleUnlock = (item) => {
    console.log(`Unlocking ${item.name} for ${item.xp} XP`);
    // Simulate unlocking logic here
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {items.map(item => (
        <GearCard
          key={item.id}
          item={item}
          isUnlocked={false}
          onUnlock={handleUnlock}
        />
      ))}
    </div>
  );
};

export default LockerRoomStore;
