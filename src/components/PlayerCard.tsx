import type { PlayerColor } from '@/types/game';

interface PlayerCardProps {
  color: PlayerColor;
  name?: string;
  joined: boolean;
  connected?: boolean;
  result?: { durationMs: number; correct: boolean } | null;
  isWinner?: boolean;
}

const colorConfig = {
  blue: {
    label: 'BLUE WIZARD',
    border: 'border-blue-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    dot: 'bg-blue-500',
  },
  red: {
    label: 'RED WIZARD',
    border: 'border-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    dot: 'bg-red-500',
  },
};

export default function PlayerCard({ color, name, joined, connected, result, isWinner }: PlayerCardProps) {
  const c = colorConfig[color];

  if (!joined) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-gray-600 opacity-40`}>
        <div className={`w-3 h-3 rounded-full bg-gray-600`} />
        <span className="text-gray-500 text-sm uppercase tracking-wider">{c.label}</span>
        <span className="text-gray-600 text-xs">Waiting for player…</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 p-6 rounded-2xl border-2 ${c.border} ${c.bg} ${c.glow} ${isWinner ? 'scale-105' : ''} transition-all`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${c.dot} ${connected ? 'animate-pulse' : 'opacity-30'}`} />
        <span className={`font-bold text-sm uppercase tracking-wider ${c.text}`}>{c.label}</span>
      </div>

      <span className="text-gray-300 text-base">{name || (color === 'blue' ? 'Blue Wizard' : 'Red Wizard')}</span>

      {result !== undefined && result !== null && (
        <div className="text-center">
          <span className={result.correct ? 'text-emerald-400' : 'text-red-400'}>
            {result.correct ? '✓ Correct' : '✗ Wrong'}
          </span>
          {result.durationMs >= 0 && (
            <span className="text-gray-400 text-sm font-mono block">
              {result.durationMs.toLocaleString()} ms
            </span>
          )}
        </div>
      )}

      {isWinner && (
        <span className="text-amber-400 text-sm font-bold uppercase animate-pulse">★ Winner ★</span>
      )}
    </div>
  );
}
