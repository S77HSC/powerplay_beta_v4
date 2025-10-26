// data/powerpass.config.js

export const POWERPASS = {
  seasonName: "Neon Derby",
  xpPerLevel: 120, // 120 XP per level → 1,200 XP for 10 levels
  rarityMap: {
    common:    { label: "Training",    class: "bg-white/10 border-white/15 text-white" },
    uncommon:  { label: "Matchday",    class: "bg-emerald-400/15 border-emerald-300/30 text-emerald-200" },
    rare:      { label: "Pro",         class: "bg-blue-400/15 border-blue-300/30 text-blue-200" },
    epic:      { label: "European",    class: "bg-fuchsia-400/15 border-fuchsia-300/30 text-fuchsia-200" },
    legendary: { label: "World Class", class: "bg-amber-400/15 border-amber-300/30 text-amber-200" },
  },
  levels: [
    { level: 1,  name: "Academy Boots",        rarity: "common",    img: "/items/boots_basic.png" },
    { level: 2,  name: "Warm-Up Emote",        rarity: "uncommon",  img: "/items/emote_warmup.png",  premiumOnly: true },
    { level: 3,  name: "Grip Socks",           rarity: "uncommon",  img: "/items/socks_grip.png" },
    { level: 4,  name: "Captain’s Armband",    rarity: "rare",      img: "/items/armband.png",       premiumOnly: true },
    { level: 5,  name: "Matchday Kit",         rarity: "rare",      img: "/items/kit_match.png" },
    { level: 6,  name: "Pro Boots",            rarity: "rare",      img: "/items/boots_pro.png",     premiumOnly: true },
    { level: 7,  name: "European Night Trail", rarity: "epic",      img: "/items/trail_euro.png",    premiumOnly: true },
    { level: 8,  name: "Club Legend Banner",   rarity: "epic",      img: "/items/banner_legend.png" },
    { level: 9,  name: "World Class Ball",     rarity: "legendary", img: "/items/ball_world.png",    premiumOnly: true },
    { level: 10, name: "Ballon d’Or Kit",      rarity: "legendary", img: "/items/kit_ballondor.png", premiumOnly: true },
  ],
};
