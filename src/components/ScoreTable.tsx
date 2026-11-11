'use client';

import type { GameScore, PlayerColor, RoundResults } from '@/types/game';

interface ScoreTableProps {
  names: Partial<Record<PlayerColor, string>>;
  score: GameScore;
  results: RoundResults;
  /** Game winner, highlighted. */
  winner?: PlayerColor | null;
  /** Larger text for the host screen. */
  large?: boolean;
}

const COLORS: PlayerColor[] = ['blue', 'red'];
const STYLE: Record<PlayerColor, { text: string; border: string; label: string }> = {
  blue: { text: 'text-blue-400', border: 'border-blue-500', label: 'Blue' },
  red: { text: 'text-red-400', border: 'border-red-500', label: 'Red' },
};

/** Side-by-side Blue vs Red table: won / lost / draws, plus the result of every round. */
export default function ScoreTable({ names, score, results, winner, large }: ScoreTableProps) {
  const lost = (c: PlayerColor) => score[c === 'blue' ? 'red' : 'blue'];
  const rows: Array<[string, (c: PlayerColor) => number]> = [
    ['Won', (c) => score[c]],
    ['Lost', lost],
    ['Draws', () => score.draws],
  ];
  const cell = large ? 'px-6 py-3 text-2xl' : 'px-3 py-2 text-lg';

  return (
    <div className="w-full">
      <table className="w-full border-collapse text-center">
        <caption className="sr-only">Game score</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">Result</th>
            {COLORS.map((c) => (
              <th
                key={c}
                scope="col"
                className={`${cell} border-b-2 ${STYLE[c].border} ${STYLE[c].text} font-black uppercase ${winner === c ? 'bg-amber-500/15' : ''}`}
              >
                <div className={large ? 'text-3xl' : 'text-xl'}>{names[c] || `${STYLE[c].label} Wizard`}</div>
                <div className="text-xs font-bold tracking-widest opacity-80">
                  {STYLE[c].label} wizard{winner === c ? ' · 🏆 winner' : ''}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-800">
              <th scope="row" className={`${cell} text-left text-gray-400 font-medium`}>{label}</th>
              {COLORS.map((c) => (
                <td key={c} className={`${cell} font-mono font-bold text-gray-100 ${winner === c ? 'bg-amber-500/10' : ''}`}>{value(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {results.length > 0 && (
        <ol className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Round results">
          {results.map((r, i) => (
            <li
              key={i}
              className={`px-3 py-1 rounded-full border text-sm font-bold ${r ? `${STYLE[r].border} ${STYLE[r].text}` : 'border-gray-600 text-gray-400'}`}
            >
              R{i + 1}: {r ? names[r] || STYLE[r].label : 'Draw'}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
