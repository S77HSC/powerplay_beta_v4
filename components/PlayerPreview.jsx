// components/PlayerPreview.jsx
export default function PlayerPreview({ equipped }) {
  return (
    <div className="relative w-[300px] h-[500px] mx-auto mb-8">
      {/* Base player image */}
      <img
        src="/LockerRoom/base/player_base.png"
        alt="Player Base"
        className="absolute inset-0 w-full h-full object-contain z-10"
      />

      {/* Layer equipped gear */}
      {equipped.kit && (
        <img
          src={equipped.kit.image}
          alt={equipped.kit.name}
          className="absolute inset-0 w-full h-full object-contain z-20"
        />
      )}
      {equipped.boots && (
        <img
          src={equipped.boots.image}
          alt={equipped.boots.name}
          className="absolute inset-0 w-full h-full object-contain z-30"
        />
      )}
      {equipped.accessory && (
        <img
          src={equipped.accessory.image}
          alt={equipped.accessory.name}
          className="absolute inset-0 w-full h-full object-contain z-40"
        />
      )}
    </div>
  );
}
