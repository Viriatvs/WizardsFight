'use client';

import { MAX_TEAM_SIZE } from '@/lib/teams';
import type { PlayerColor } from '@/types/game';
import PixelIcon from '@/components/PixelIcon';

interface PlayerCardProps {
  color: PlayerColor;
  /** The team's wizards in join order; `ready` = pressed Let's Fight (shown only while waiting). */
  members: Array<{ name: string; ready?: boolean }>;
  connected?: boolean;
  /** Last round's result, shown for a one-wizard team. */
  result?: { durationMs: number; correct: boolean } | null;
  isWinner?: boolean;
  wins?: number;
  /** Opens a phone tab on this team, while it has room. */
  joinUrl?: string;
}

const colorConfig = {
  blue: {
    label: 'BLUE TEAM',
    border: 'border-blue-500',
    glow: 'shadow-[6px_6px_0_0_rgba(0,0,0,0.65)]',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    dot: 'bg-blue-500',
    icon: 'wizardBlue' as const,
  },
  red: {
    label: 'RED TEAM',
    border: 'border-red-500',
    glow: 'shadow-[6px_6px_0_0_rgba(0,0,0,0.65)]',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    dot: 'bg-red-500',
    icon: 'wizardRed' as const,
  },
};

/** One team on the main screen: its wizards, round wins and a link to add a wizard. */
export default function PlayerCard({ color, members, connected, result, isWinner, wins, joinUrl }: PlayerCardProps) {
  const c = colorConfig[color];

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 border-4 border-dashed border-gray-600 bg-gray-950/60 opacity-60 hover:opacity-100 transition-opacity">
        {joinUrl ? (
          <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 cursor-pointer">
            <span className={`text-5xl ${c.text}`}><PixelIcon name={c.icon} /></span>
            <span className="text-gray-400 text-sm uppercase tracking-wider">{c.label}</span>
            <span className="text-gray-500 text-xs">Click to open wizard tab</span>
          </a>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full bg-gray-600" />
            <span className="text-gray-500 text-sm uppercase tracking-wider">{c.label}</span>
            <span className="text-gray-600 text-xs">Waiting for wizards…</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 p-6 border-4 ${c.border} ${c.bg} ${c.glow} ${isWinner ? 'scale-105' : ''} transition-all`}>
      {wins !== undefined && wins > 0 && (
        <div className={`text-3xl font-black ${c.text}`}><PixelIcon name="trophy" /> {wins}</div>
      )}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${c.dot} ${connected ? 'animate-pulse' : 'opacity-30'}`} />
        <span className={`font-bold text-sm uppercase tracking-wider ${c.text}`}>{c.label}</span>
        <span className="text-gray-500 text-xs font-mono">{members.length}/{MAX_TEAM_SIZE}</span>
      </div>
      <ul className="text-center">
        {members.map((m, i) => (
          <li key={i} className="text-gray-300 text-base">
            {m.ready && <span className="text-emerald-400" aria-label="ready">✓ </span>}
            {m.name}
          </li>
        ))}
      </ul>
      {members.length === 1 && result !== undefined && result !== null && (
        <div className="text-center">
          <span className={result.correct ? 'text-emerald-400' : 'text-red-400'}>
            {result.correct ? '✓ Correct' : '✗ Wrong'}
          </span>
          {result.durationMs >= 0 && (
            <span className="text-gray-400 text-sm font-mono block">{result.durationMs.toLocaleString()} ms</span>
          )}
        </div>
      )}
      {isWinner && (
        <span className="text-amber-400 text-sm font-bold uppercase animate-pulse">★ Winner ★</span>
      )}
      {joinUrl && (
        <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={`text-xs underline ${c.text} opacity-70 hover:opacity-100`}>
          + Add a wizard to this team
        </a>
      )}
    </div>
  );
}
