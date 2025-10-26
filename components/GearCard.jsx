'use client';
import React from 'react';

export default function GearCard({
  item,
  view = 'store',          // 'store' | 'locker'
  ownedItems = [],         // array of owned ids (DB ids)
  isEquipped = false,
  isLoading = false,
  isDisabled = false,
  onUnlock,                // optional handler for buying/unlocking
  onZoom,
  onClick,
}) {
  const isStore = view === 'store';
  const owned = isStore
    ? (Array.isArray(ownedItems) && ownedItems.includes(item.id)) // STORE: trust the prop
    : true;                                                       // LOCKER: owned by definition

  return (
    <div className="relative bg-white/5 rounded-xl border border-white/10 p-3 hover:bg-white/10 transition">
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-white/5 flex items-center justify-center">
        <img
          src={item.image || item.image_url}
          alt={item.name}
          className="max-w-full max-h-full object-contain"
          onClick={onZoom}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{item.name}</div>
          {!!item.xp && (
            <div className="text-xs text-white/60 truncate">{item.xp} XP</div>
          )}
        </div>

        {/* Status pill */}
        {owned ? (
          <span className="ml-auto px-2 py-1 rounded-md text-xs font-semibold bg-emerald-500 text-black">
            {isEquipped ? 'Equipped' : 'Owned'}
          </span>
        ) : (
          <span className="ml-auto px-2 py-1 rounded-md text-xs font-semibold bg-white/15 text-white/80">
            Locked
          </span>
        )}
      </div>

      {/* Store action (only when not owned and a handler is provided) */}
      {isStore && !owned && onUnlock && (
        <button
          className="mt-2 w-full rounded-md bg-yellow-400 text-black font-bold py-2 disabled:opacity-60"
          disabled={isLoading || isDisabled}
          onClick={() => onUnlock(item)}
        >
          {isLoading ? 'Unlocking…' : 'Unlock'}
        </button>
      )}
    </div>
  );
}
