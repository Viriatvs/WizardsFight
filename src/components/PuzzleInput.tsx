'use client';

import { useEffect, useState } from 'react';
import { isSolved } from '@/lib/modes';

interface PuzzleInputProps {
  image: string;
  cols: number;
  rows: number;
  /** Starting scramble: order[slot] = tile shown in that slot. */
  initialOrder: number[];
  /** Called once with the solved order ("0,1,2,…") when the picture is complete. */
  onSolved: (order: string) => void;
  /** Server's verdict once the solved picture was sent. */
  result: { correct: boolean; durationMs: number } | null;
  /** Local timestamp when the round ends in a draw. */
  deadline: number | null;
}

/** Tap a tile, then another, to swap them. The finished picture is sent automatically. */
export default function PuzzleInput({ image, cols, rows, initialOrder, onSolved, result, deadline }: PuzzleInputProps) {
  const [order, setOrder] = useState(initialOrder);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const solved = isSolved(order, cols * rows);

  useEffect(() => {
    if (solved) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [solved]);

  // A rejected solution (should not happen) unlocks the board again.
  useEffect(() => {
    if (result && !result.correct) setOrder(initialOrder);
  }, [result, initialOrder]);

  const tap = (slot: number) => {
    if (solved) return;
    if (selected === null) return setSelected(slot);
    if (selected === slot) return setSelected(null);
    const next = [...order];
    [next[selected], next[slot]] = [next[slot], next[selected]];
    setOrder(next);
    setSelected(null);
    setMoves((m) => m + 1);
    if (isSolved(next, cols * rows)) onSolved(next.join(','));
  };

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const tileStyle = (tile: number): React.CSSProperties => ({
    backgroundImage: `url(${image})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${((tile % cols) / (cols - 1)) * 100}% ${(Math.floor(tile / cols) / (rows - 1)) * 100}%`,
    imageRendering: 'pixelated',
  });

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full">
      <div className="flex items-center gap-4 font-mono text-gray-400">
        {secondsLeft !== null && !solved && (
          <span className={secondsLeft <= 10 ? 'text-red-400 font-bold' : ''}>⏳ {secondsLeft}s left</span>
        )}
        <span>{moves} move{moves === 1 ? '' : 's'}</span>
      </div>

      <p className="text-gray-300 text-center">
        {solved ? 'Picture complete!' : 'Tap two pieces to swap them. Rebuild the wizard!'}
      </p>

      <div
        role="group"
        aria-label="Puzzle board"
        className={`grid gap-0.5 w-full max-w-[360px] aspect-[3/4] overflow-hidden border-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.65)] ${solved ? 'border-emerald-500' : 'border-gray-700'}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {order.map((tile, slot) => (
          <button
            key={slot}
            onClick={() => tap(slot)}
            disabled={solved}
            aria-label={`Piece in position ${slot + 1}${selected === slot ? ', selected' : ''}`}
            aria-pressed={selected === slot}
            className={`min-h-[44px] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 transition-transform
              ${selected === slot ? 'ring-4 ring-inset ring-amber-400 scale-95' : ''}`}
            style={tileStyle(tile)}
          />
        ))}
      </div>

      {result?.correct && (
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400 animate-bounce">✓ SOLVED</div>
          <div className="text-gray-400 font-mono">⚡ {result.durationMs.toLocaleString()} ms</div>
        </div>
      )}
    </div>
  );
}
