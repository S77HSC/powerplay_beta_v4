
'use client';

import React from 'react';
import GearCard from './GearCard';

const LockerRoom = ({ playerId, activeTab, items, setSelectedItem }) => {
  const handleUnlock = (item) => {
    console.log(`Unlocking ${item.name} for ${item.xp} XP`);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {items.map(item => (
        <GearCard
          key={item.id}
          item={item}
          isUnlocked={true}
          onUnlock={handleUnlock}
          onClick={() => setSelectedItem(item)}
        />
      ))}
    </div>
  );
};

export default LockerRoom;
