import Image from 'next/image';
import React from 'react';

/** Minimal country -> emoji helper (best-effort). */
function getFlagEmoji(country = '') {
  try {
    const code = country.trim().slice(0, 2).toUpperCase();
    if (code.length !== 2) return '🏳️';
    const A = 0x1f1e6;
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const [c1, c2] = [code[0], code[1]];
    if (!alpha.includes(c1) || !alpha.includes(c2)) return '🏳️';
    return String.fromCodePoint(A + (c1.charCodeAt(0) - 65)) +
           String.fromCodePoint(A + (c2.charCodeAt(0) - 65));
  } catch {
    return '🏳️';
  }
}

/**
 * LeaderboardPreviewCard
 *
 * Props:
 * - players: Array<{ id, name, country, avatar_url, ... }>
 * - highlightId?: number | string
 * - valueKey?: string (which numeric field to show; default: 'points')
 * - label?: string (unit label to display; default: 'XP')
 * - maxValue?: number (progress bar cap; if absent, auto uses max in data)
 */
export default function LeaderboardPreviewCard({
  players = [],
  highlightId,
  valueKey = 'points',
  label = 'XP',
  maxValue,
}) {
  // Normalize values and compute a safe max for the progress bar
  const normalized = (players ?? []).map((p) => ({
    ...p,
    _value: Number(p?.[valueKey] ?? 0),
  }));

  const autoMax = normalized.reduce((m, r) => Math.max(m, r._value), 0);
  const cap = Math.max(1, Number.isFinite(maxValue) ? maxValue : autoMax || 1);

  return (
    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
      {normalized.map((player, index) => {
        const isHighlighted = player.id === highlightId;
        const pct = Math.min(100, Math.round((player._value / cap) * 100));

        return (
          <div
            key={player.id ?? index}
            className={`flex items-center gap-3 p-2 rounded-md border ${
              isHighlighted
                ? 'bg-yellow-900/30 border-yellow-400/40'
                : 'bg-gray-800/60 border-white/10'
            }`}
          >
            {/* Rank / Medal */}
            <div className="w-8 text-center text-sm font-semibold shrink-0">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </div>

            {/* Avatar (if you want to show it) */}
            {player.avatar_url ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                <Image
                  src={
                    player.avatar_url.startsWith('http')
                      ? player.avatar_url
                      : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`
                  }
                  alt={player.name || 'avatar'}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center border border-white/10 shrink-0">
                <span className="text-xs">👤</span>
              </div>
            )}

            {/* Flag */}
            <div className="w-6 h-4 shrink-0">
              <span className="text-lg leading-none">{getFlagEmoji(player.country)}</span>
            </div>

            {/* Player Info + Bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate text-white">{player.name ?? 'Unknown'}</span>
                {player.country && (
                  <span className="text-xs opacity-70">{getFlagEmoji(player.country)}</span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 mt-1 bg-gray-600/60 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-yellow-400 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Value Display */}
            <div className="text-xs font-bold text-right text-white whitespace-nowrap">
              {player._value.toLocaleString()} {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
