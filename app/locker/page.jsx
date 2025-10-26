'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LockerRoom from '../../components/LockerRoom';
import LockerRoomStore from '../../components/LockerRoomStore';
import NeonIconBar from '../../lobbycomponents/NeonIconBar';
import ItemPreviewModal from '../../components/ItemPreviewModal';
import mockitems from '../../data/mockitems';

const tabToSlot = {
  kits: 'top',
  boots: 'boots',
  footballs: 'ball',
  accessories: null,
  shorts: 'shorts',
  socks: 'socks',
};

export default function LockerPage() {
  const [player, setPlayer] = useState(null);
  const [view, setView] = useState('store');
  const [activeTab, setActiveTab] = useState('kits');
  const [ownedIds, setOwnedIds] = useState([]);
  const [zoomItem, setZoomItem] = useState(null);

  const TABS = useMemo(() => {
    const keys = Object.keys(mockitems || {});
    const order = ['kits', 'shorts', 'socks', 'boots', 'accessories', 'footballs'];
    return order.filter(k => keys.includes(k) && (mockitems[k] || []).length > 0);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('players')
        .select('id, points')
        .eq('auth_id', user.id)
        .single();
      if (!p) return;
      setPlayer(p);

      const { data: pi } = await supabase
        .from('player_items')
        .select('item_id')
        .eq('player_id', p.id);
      setOwnedIds((pi || []).map(r => r.item_id));
    })();
  }, []);

  const allTabItems = useMemo(() => mockitems?.[activeTab] || [], [activeTab]);
  const lockerItems  = useMemo(() => allTabItems.filter(it => ownedIds.includes(it.id)), [allTabItems, ownedIds]);
  const storeItems   = useMemo(() => allTabItems, [allTabItems]);

  const tabBtn = (isActive) =>
    `px-3 py-1 rounded-md border transition ${
      isActive ? 'bg-white text-black border-white' : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
    } text-[clamp(11px,1.1vw,14px)] font-semibold`;

  return (
    <main className="min-h-screen w-full bg-black flex items-center justify-center text-white">
      <div className="relative aspect-[16/9]" style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
        {/* Background */}
        <div className="absolute inset-0">
          <img src="/images/locker_room_background.png" alt="" className="w-full h-full object-cover brightness-95" />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 h-14 flex items-center gap-5 px-5">
          <div className="neon-bar-compact z-20">
            <NeonIconBar />
          </div>

          <div className="hidden md:flex items-center gap-5 text-[clamp(12px,1.1vw,15px)]">
            <span className="px-3 py-1 rounded bg-white text-black font-bold">LOCKER</span>
            <span className="text-white/80">BATTLE PASS</span>
            <span className="text-white/80">ITEM SHOP</span>
            <span className="text-white/80">CAREER</span>
          </div>
          <span className="ml-auto text-white/80 text-[clamp(12px,1.1vw,15px)]">XP: {player?.points ?? 0}</span>
        </div>

        {/* View + Tabs */}
        <div className="absolute left-8 top-20 z-20 flex items-center gap-3">
          <button
            onClick={() => setView('locker')}
            className={`px-5 py-2 rounded-lg text-[clamp(12px,1.1vw,14px)] font-semibold shadow ${view === 'locker' ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
          >
            YOUR GEAR
          </button>
          <button
            onClick={() => setView('store')}
            className={`px-5 py-2 rounded-lg text-[clamp(12px,1.1vw,14px)] font-semibold shadow ${view === 'store' ? 'bg-white text-black' : 'bg-white/20 text-white'}`}
          >
            STORE
          </button>

          <div className="ml-4 flex gap-2">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={tabBtn(activeTab === tab)}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* BLUE DIVIDER under tabs */}
        <div className="absolute left-8 right-[46%] top-[8.25rem] h-[2px] bg-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,.55)] rounded-full pointer-events-none z-[1]" />

        {/* LEFT GRID — pushed further down (top-36) */}
        <div className="absolute left-8 top-36 bottom-8 w-[48%] overflow-y-auto subscroll pr-2 z-[2]">
          {view === 'store' ? (
            <LockerRoomStore
              compact
              items={storeItems}
              activeTab={activeTab}
              player={player}
              ownedItems={ownedIds}
              setOwnedItems={setOwnedIds}
              setPlayer={setPlayer}
              onZoom={setZoomItem}
              setSelectedItem={() => {}}
              hideEquippedUI
            />
          ) : (
            <LockerRoom
              compact
              items={lockerItems}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              ownedItems={ownedIds}
              onZoom={setZoomItem}
              onEquip={() => {}}
              equippedIds={[]}
              setSelectedItem={() => {}}
              hideEquip
            />
          )}
        </div>

        {/* RIGHT: character preview */}
        <div className="absolute right-0 top-20 bottom-8 w-[46%] flex items-center justify-center">
          <div className="relative w-[70%] h-[88%] flex items-end justify-center">
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl bg-cyan-300/30" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[72%] h-8 rounded-full bg-black/50 blur" />
            <img src="/characters/striker.png" alt="PowerPlay Striker" className="relative max-h-full object-contain drop-shadow-2xl" />
          </div>
        </div>

        <ItemPreviewModal item={zoomItem} open={!!zoomItem} onClose={() => setZoomItem(null)} />
      </div>
    </main>
  );
}
