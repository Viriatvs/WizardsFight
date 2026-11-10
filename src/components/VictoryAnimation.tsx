'use client';

import type { PlayerColor } from '@/types/game';

interface VictoryAnimationProps {
  winnerColor: PlayerColor | null;
  winnerName: string | null;
  durationMs: number | null;
  timedOut?: boolean;
}

export default function VictoryAnimation({ winnerColor, winnerName, durationMs, timedOut }: VictoryAnimationProps) {
  const colorText = winnerColor === 'blue' ? 'text-blue-400' : winnerColor === 'red' ? 'text-red-400' : 'text-gray-400';

  const victoryGif = winnerColor === 'blue'
    ? '/images/victory-blue-wizard.gif'
    : winnerColor === 'red'
      ? '/images/victory-red-wizard.gif'
      : null;

  if (timedOut || !winnerColor || !victoryGif) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
        <div className="text-center">
          <div className="text-4xl md:text-5xl font-black text-gray-400 mb-4">DRAW</div>
          <div className="text-gray-500 text-lg">No valid spell cast in time</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black animate-fade-in overflow-hidden">
      <img
        src={victoryGif}
        alt={`${winnerColor} wizard victory`}
        className="w-full h-full object-cover"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center confetti-container">
          <div className="text-2xl md:text-3xl font-bold uppercase tracking-widest text-gray-200 mb-2 drop-shadow-lg">
            The Winner Is
          </div>
          <div
            className={`text-6xl md:text-8xl font-black ${colorText} victory-text drop-shadow-2xl`}
            style={{
              textShadow: winnerColor === 'blue'
                ? '0 0 60px rgba(59,130,246,0.8), 0 0 120px rgba(59,130,246,0.4)'
                : '0 0 60px rgba(239,68,68,0.8), 0 0 120px rgba(239,68,68,0.4)',
            }}
          >
            {winnerColor === 'blue' ? 'BLUE' : 'RED'}
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${colorText} mt-2 drop-shadow-lg`}>
            {winnerName}
          </div>
          {durationMs !== null && (
            <div className="text-gray-200 font-mono mt-4 text-lg drop-shadow-md">
              ⚡ {durationMs.toLocaleString()} ms
            </div>
          )}
          <div className="mt-6 flex gap-2 justify-center">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`confetti-piece w-2 h-2 rounded-full ${winnerColor === 'blue' ? 'bg-blue-300' : 'bg-red-300'}`}
                style={{
                  '--delay': `${i * 80}ms`,
                  '--x': `${(i - 10) * 20}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
