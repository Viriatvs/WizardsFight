'use client';

import type { PlayerColor } from '@/types/game';

interface BattleImageProps {
  /** Wizard names per team, in join order. */
  blueNames: string[];
  redNames: string[];
  countdown: number | null;
  battleStarted: boolean;
}

function getSceneImage(blueJoined: boolean, redJoined: boolean): string {
  if (blueJoined && redJoined) return '/images/wizards-waiting.png';
  if (blueJoined) return '/images/blue-wizard_ready.png';
  if (redJoined) return '/images/red-wizard_ready.png';
  return '/images/battlefield-waiting.png';
}

/**
 * Where each team's names sit: just above its wizard's hat, as % of the picture.
 * All three scene pictures put the wizards in the same place; update these if a picture changes.
 */
const NAME_ANCHOR: Record<PlayerColor, { left: string; bottom: string; text: string }> = {
  blue: { left: '24%', bottom: '83%', text: 'text-blue-300' },
  red: { left: '71.5%', bottom: '75.5%', text: 'text-red-300' },
};

function TeamNames({ color, names }: { color: PlayerColor; names: string[] }) {
  if (names.length === 0) return null;
  const a = NAME_ANCHOR[color];
  return (
    <ul
      aria-label={`${color === 'blue' ? 'Blue' : 'Red'} team`}
      className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none"
      style={{ left: a.left, bottom: a.bottom }}
    >
      {names.map((name, i) => (
        <li
          key={i}
          className={`font-pixel ${a.text} text-xs md:text-base lg:text-lg leading-tight whitespace-nowrap bg-black/60 px-2 py-0.5`}
          style={{ textShadow: '2px 2px 0 #000' }}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

export default function BattleImage({ blueNames, redNames, countdown, battleStarted }: BattleImageProps) {
  const blueJoined = blueNames.length > 0;
  const redJoined = redNames.length > 0;
  const bothJoined = blueJoined && redJoined;
  const imageSrc = getSceneImage(blueJoined, redJoined);

  return (
    <div className="relative w-full max-w-[1200px] mx-auto overflow-hidden border-4 border-gray-950 shadow-[8px_8px_0_0_rgba(0,0,0,0.65)]">
      <img
        src={imageSrc}
        alt="Battlefield scene"
        className="w-full h-auto block"
      />

      <TeamNames color="blue" names={blueNames} />
      <TeamNames color="red" names={redNames} />

      {!blueJoined && !redJoined && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-sm px-8 py-4 rounded-2xl border border-amber-500/30">
            <span className="text-amber-400 text-xl font-bold uppercase tracking-wider animate-pulse">
              Waiting for Wizards…
            </span>
          </div>
        </div>
      )}

      {/* Status banners sit at the bottom, on the empty floor, so they never cover the names. */}
      {(blueJoined || redJoined) && !bothJoined && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl border border-amber-500/30">
            <span className="text-amber-400 text-lg font-bold uppercase tracking-wider animate-pulse whitespace-nowrap">
              Waiting for the other team…
            </span>
          </div>
        </div>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            key={countdown}
            className="text-[12rem] md:text-[16rem] font-black text-amber-300 animate-countdown select-none leading-none"
            style={{
              textShadow: '0 0 40px rgba(245,158,11,0.8), 0 0 80px rgba(245,158,11,0.4), 0 0 120px rgba(245,158,11,0.2)',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {countdown === null && bothJoined && !battleStarted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/70 backdrop-blur-sm px-8 py-3 rounded-2xl border border-amber-500/50">
            <span className="text-amber-300 text-xl font-bold uppercase tracking-wider animate-pulse whitespace-nowrap">
              Both Teams Here — Press Let&apos;s Fight!
            </span>
          </div>
        </div>
      )}

      {battleStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
          <div
            className="text-8xl md:text-[10rem] font-black text-amber-300 battle-text select-none leading-none"
            style={{
              textShadow: '0 0 60px rgba(245,158,11,0.9), 0 0 120px rgba(245,158,11,0.5), 0 0 200px rgba(239,68,68,0.3)',
            }}
          >
            FIGHT!
          </div>
        </div>
      )}
    </div>
  );
}
