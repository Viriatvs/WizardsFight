'use client';

import { trainingSummary, formatSeconds, TRAINING_ROUNDS } from '@/lib/game';
import type { RoundResults } from '@/types/game';

interface TrainingSummaryProps {
  results: RoundResults;
  times: Array<number | null>;
  /** Larger text for the main screen. */
  large?: boolean;
}

/** Training alone: played / solved / failed / best time, plus one chip per round. */
export default function TrainingSummary({ results, times, large }: TrainingSummaryProps) {
  const s = trainingSummary(results, times);
  const stats: Array<[string, string, string]> = [
    ['Played', `${s.played} / ${TRAINING_ROUNDS}`, 'text-gray-100'],
    ['Solved', String(s.solved), 'text-emerald-400'],
    ['Failed', String(s.failed), 'text-red-400'],
    ['Best time', s.best !== null ? formatSeconds(s.best) : '—', 'text-amber-300'],
  ];

  return (
    <div className="w-full">
      <dl className="grid grid-cols-2 gap-3">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2">
            <dt className={`text-gray-400 ${large ? 'text-base' : 'text-xs'} uppercase tracking-wider`}>{label}</dt>
            <dd className={`font-mono font-bold ${color} ${large ? 'text-4xl' : 'text-2xl'}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {results.length > 0 && (
        <ol className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Round results">
          {results.map((r, i) => (
            <li
              key={i}
              className={`px-3 py-1 rounded-full border text-sm font-bold ${r ? 'border-emerald-500 text-emerald-300' : 'border-red-500/70 text-red-300'}`}
            >
              R{i + 1}: {r && times[i] !== null ? formatSeconds(times[i]!) : 'Failed'}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
