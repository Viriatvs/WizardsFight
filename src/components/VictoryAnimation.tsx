'use client';

import type { PlayerColor } from '@/types/game';

interface VictoryAnimationProps {
  winnerColor: PlayerColor | null;
  /** The name the player typed when joining; shown as the headline over the animation. */
  winnerName: string | null;
  /** Line above the name, e.g. "Round 2 goes to" or "The winner of the game is". */
  title: string;
  /** Line under the name, e.g. the game score. */
  subtitle?: string;
  durationMs: number | null;
  /** Shown instead of a winner when nobody won. */
  drawReason?: string;
}

export const VICTORY_GIF: Record<PlayerColor, string> = {
  blue: '/images/victory-blue-wizard.gif',
  red: '/images/victory-red-wizard.gif',
};

/** Full-screen result overlay for the host (main) screen. */
export default function VictoryAnimation({ winnerColor, winnerName, title, subtitle, durationMs, drawReason }: VictoryAnimationProps) {
  if (!winnerColor) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
        <div className="text-center px-4">
          <div className="text-2xl md:text-3xl font-bold uppercase tracking-widest text-gray-300 mb-2">{title}</div>
          <div className="text-6xl md:text-7xl font-black text-gray-400 mb-4">DRAW</div>
          <div className="text-gray-400 text-lg">{drawReason ?? 'No valid spell cast in time'}</div>
          {subtitle && <div className="text-gray-200 text-2xl font-bold mt-6">{subtitle}</div>}
        </div>
      </div>
    );
  }

  const colorText = winnerColor === 'blue' ? 'text-blue-400' : 'text-red-400';
  const glow = winnerColor === 'blue'
    ? '0 0 60px rgba(59,130,246,0.8), 0 0 120px rgba(59,130,246,0.4), 0 4px 12px rgba(0,0,0,0.9)'
    : '0 0 60px rgba(239,68,68,0.8), 0 0 120px rgba(239,68,68,0.4), 0 4px 12px rgba(0,0,0,0.9)';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black animate-fade-in overflow-hidden">
      <img src={VICTORY_GIF[winnerColor]} alt={`${winnerColor} wizard victory`} className="w-full h-full object-cover" />

      <div className="absolute inset-x-0 top-0 flex flex-col items-center pt-10 md:pt-16 px-4 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-16">
        <div className="text-center confetti-container">
          <div className="text-2xl md:text-3xl font-bold uppercase tracking-widest text-gray-100 mb-2 drop-shadow-lg">{title}</div>
          <div className={`text-6xl md:text-8xl font-black ${colorText} victory-text break-words`} style={{ textShadow: glow }}>
            {winnerName || (winnerColor === 'blue' ? 'Blue Wizard' : 'Red Wizard')}
          </div>
          <div className={`text-xl md:text-2xl font-bold uppercase tracking-widest ${colorText} mt-2 drop-shadow-lg`}>
            {winnerColor === 'blue' ? 'Blue' : 'Red'} wizard
          </div>
          {subtitle && <div className="text-gray-100 text-2xl md:text-3xl font-bold mt-4 drop-shadow-lg">{subtitle}</div>}
          {durationMs !== null && (
            <div className="text-gray-200 font-mono mt-3 text-lg drop-shadow-md">⚡ {durationMs.toLocaleString()} ms</div>
          )}
          <div className="mt-6 flex gap-2 justify-center">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`confetti-piece w-2 h-2 rounded-full ${winnerColor === 'blue' ? 'bg-blue-300' : 'bg-red-300'}`}
                style={{ '--delay': `${i * 80}ms`, '--x': `${(i - 10) * 20}px` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
