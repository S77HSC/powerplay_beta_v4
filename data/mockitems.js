const mockItems = {
  kits: [
    { id: 'kit1', name: 'Red Home Kit', image: '/LockerRoom/kits/powerplay_kit_red.png', xp: 100 },
    { id: 'kit2', name: 'Blue Away Kit', image: '/LockerRoom/kits/powerplay_kit_blue.png', xp: 150 },
    { id: 'kit3', name: 'Legend Red and White', image: '/LockerRoom/kits/powerplay_legend_re_white.png', xp: 150 }
  ],
  boots: [
    { id: 'boot1', name: 'Power Boots', image: '/LockerRoom/boots/power_boots.png', xp: 140 },
    { id: 'boot2', name: 'Speed Boots', image: '/LockerRoom/boots/speed_boots.png', xp: 160 },
    { id: 'boot3', name: 'Precision Boots', image: '/LockerRoom/boots/power_precision.png', xp: 190 },
    { id: 'boot4', name: 'Legend Boots', image: '/LockerRoom/boots/legend_boots.png', xp: 190 },
    { id: 'boot5', name: 'Star Striker Boots', image: '/LockerRoom/boots/star_striker.png', xp: 300 },
    { id: 'boot6', name: 'Launching Soon Boots', image: '/LockerRoom/boots/launching_soon.png', xp: 300 }
  ],
  badges: [
    { id: 'badge1', name: 'Champion Badge', image: '/LockerRoom/badges/champion.png', xp: 80 },
    { id: 'badge2', name: 'Veteran Badge', image: '/LockerRoom/badges/veteran.png', xp: 90 }
  ],
  celebrations: [
    { id: 'cel1', name: 'Backflip', image: '/LockerRoom/celebrations/backflip.png', xp: 110 },
    { id: 'cel2', name: 'Slide Tackle', image: '/LockerRoom/celebrations/launching_soon.png', xp: 150 }
  ],
  footballs: [
    { id: 'ball1', name: 'Powerplay Championship', image: '/LockerRoom/Footballs/Powerplay_Championship.png', xp: 100 },
    { id: 'ball2', name: 'Powerplay Heritage', image: '/LockerRoom/Footballs/Powerplay_Heritage.png', xp: 110 },
    { id: 'ball3', name: 'Powerplay Non League', image: '/LockerRoom/Footballs/Powerplay_Non_League.png', xp: 120 },
    { id: 'ball4', name: 'Powerplay Premiere', image: '/LockerRoom/Footballs/Powerplay_Premiere.png', xp: 130 },
    { id: 'ball5', name: 'Powerplay Tango', image: '/LockerRoom/Footballs/Powerplay_Tango.png', xp: 140 },
    { id: 'ball6', name: 'Powerplay Galaxy', image: '/LockerRoom/Footballs/Untitled design (17).png', xp: 150 },
    { id: 'ball7', name: 'Powerplay World Cup', image: '/LockerRoom/Footballs/World_Cup.png', xp: 160 },
    { id: 'ball8', name: 'Champions League', image: '/LockerRoom/Footballs/Champions_League.png', xp: 170 }
  ],
  accessories: [
    { id: 'acc1', name: 'Grip Socks Pro', image: '/LockerRoom/accessories/grip_socks_pro.png', xp: 140 },
    { id: 'acc2', name: 'Grip Socks Style', image: '/LockerRoom/accessories/grip_socks_style.png', xp: 160 },
    { id: 'acc3', name: 'Captain Armband', image: '/LockerRoom/accessories/captain_armband.png', xp: 200 },
    { id: 'acc4', name: 'Power Beanie', image: '/LockerRoom/accessories/beanie.png', xp: 120 },
    { id: 'acc5', name: 'Power Beanie Blue', image: '/LockerRoom/accessories/beanie_blue.png', xp: 130 },
    { id: 'acc6', name: 'Power Snapback', image: '/LockerRoom/accessories/cap.png', xp: 150 }
  ]
};

const categories = ["kits", "boots", "badges", "celebrations", "footballs", "accessories"];

export default mockItems;
