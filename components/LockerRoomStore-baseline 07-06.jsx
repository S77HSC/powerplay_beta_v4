import React from 'react';
import GearCard from './GearCard';
import { supabase } from '../lib/supabase';

const LockerRoomStore = ({ playerId, activeTab, items, setSelectedItem }) => {
  const [ownedItems, setOwnedItems] = React.useState([]);
  const [playerXP, setPlayerXP] = React.useState(0);

  React.useEffect(() => {
    const fetchOwnedAndXP = async () => {
      const { data: owned } = await supabase
        .from('player_items')
        .select('item_id')
        .eq('player_id', playerId);
      setOwnedItems(owned.map(i => i.item_id));

      const { data: player } = await supabase
        .from('players')
        .select('points')
        .eq('id', playerId)
        .single();
      setPlayerXP(player.points);
    };

    fetchOwnedAndXP();
  }, [playerId]);

  const handleUnlock = async (item) => {
    if (ownedItems.includes(item.id)) return alert('Already unlocked');
    if (playerXP < item.xp) return alert('Not enough XP');

    const { error: xpError } = await supabase
      .from('players')
      .update({ points: playerXP - item.xp })
      .eq('id', playerId);

    const { error: insertError } = await supabase
      .from('player_items')
      .insert({
        player_id: playerId,
        item_id: item.id,
        item_type: 'manual',
        source: 'store'
      });

    if (!xpError && !insertError) {
      alert(`Unlocked ${item.name}!`);
      setOwnedItems(prev => [...prev, item.id]);
      setPlayerXP(prev => prev - item.xp);
    } else {
      alert('Unlock failed.');
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {items.map(item => (
        <GearCard
          key={item.id}
          item={item}
          isUnlocked={ownedItems.includes(item.id)}
          onUnlock={() => handleUnlock(item)}
          onClick={() => setSelectedItem(item)}
        />
      ))}
    </div>
  );
};

export default LockerRoomStore;
