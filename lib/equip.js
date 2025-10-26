// /lib/equip.js
export function setLocalEquip(slot, itemId) {
  try {
    const cur = JSON.parse(localStorage.getItem('pp_equipped') || '{}');
    cur[slot] = itemId;
    localStorage.setItem('pp_equipped', JSON.stringify(cur));
    // poke listeners so AvatarLayers refreshes
    window.dispatchEvent(new Event('pp:equip'));
  } catch {}
}
