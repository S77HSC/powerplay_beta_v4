import Image from 'next/image';

export default function LeaderboardPreviewCard({ players, highlightId }) {
  return (
    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
      {players?.map((player, index) => {
        const isHighlighted = player.id === highlightId;

        return (
          <div
            key={player.id || index}
            className={`flex items-center gap-3 p-2 rounded-md ${
              isHighlighted ? 'bg-yellow-900/40' : 'bg-gray-800/60'
            }`}
          >
            {/* Rank / Medal */}
            <div className="w-5 text-center text-sm font-semibold">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </div>

            {/* Country Flag */}
            <div className="w-6 h-4 shrink-0">
              <span className="text-lg">{getFlagEmoji(player.country)}</span>
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate text-white">{player.name}</span>
                {player.country && (
                  <span className="text-sm">{getFlagEmoji(player.country)}</span>
                )}
              </div>

              {/* XP Progress Bar */}
              <div className="w-full h-2 mt-1 bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-yellow-400"
                  style={{ width: `${Math.min((player.points || 0) / 400 * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* XP Display */}
            <div className="text-xs font-bold text-right text-white whitespace-nowrap">
              {player.points} XP
            </div>
          </div>
        );
      })}
    </div>
  );
}