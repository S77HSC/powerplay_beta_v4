'use client';

import React from 'react';
import LockerRoomStore from './LockerRoomStore';

/**
 * Same price helper here in case you show prices in the locker too
 * (You can remove if you don't need it on this side).
 */
const COST_KEYS = ['xp','xpCost','xp_cost','costXP','cost_xp','unlock_xp','price','cost','unlock_cost'];
function getCost(it) {
  for (const k of COST_KEYS) {
    const v = it?.[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(+v)) return +v;
  }
  return null;
}

/**
 * LockerRoom (wrapper)
 * Props:
 * - items: items for the current tab
 * - activeTab, setActiveTab
 * - view ('store' | 'locker'), setView
 * - player, setPlayer
 * - ownedItems (array of STRING ids), setOwnedItems
 * - onEquip (optional) if you support equipping in locker view
 */
export default function LockerRoom({
  items = [],
  activeTab,
  setActiveTab,
  view = 'store',
  setView,
  player,
  setPlayer,
  ownedItems = [],
  setOwnedItems,
  onEquip,
  tabs = ['kits', 'boots', 'accessories', 'footballs'], // customize your tabs
}) {
  // Small helper: ensure ownedItems setter normalizes to strings and dedupes.
  // If your parent already does this, you can pass setOwnedItems directly.
  const setOwnedItemsNormalized = (updater) => {
    setOwnedItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return Array.from(new Set((next || []).map(x => String(x))));
    });
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab?.(tab)}
              className={`px-3 py-1 rounded-full border text-sm ${active ? 'font-semibold' : 'opacity-70'}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      {setView && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('store')}
            className={`px-3 py-1 rounded-md border text-sm ${view === 'store' ? 'font-semibold' : 'opacity-70'}`}
          >
            Store
          </button>
          <button
            type="button"
            onClick={() => setView('locker')}
            className={`px-3 py-1 rounded-md border text-sm ${view === 'locker' ? 'font-semibold' : 'opacity-70'}`}
          >
            Your Gear
          </button>
        </div>
      )}

      {/* Body */}
      <LockerRoomStore
        items={items}
        activeTab={activeTab}
        player={player}
        setPlayer={setPlayer}
        ownedItems={ownedItems}
        setOwnedItems={setOwnedItemsNormalized}
        view={view}
      />
    </div>
  );
}
