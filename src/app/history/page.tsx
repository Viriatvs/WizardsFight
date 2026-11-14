import type { Metadata } from 'next';
import Link from 'next/link';
import { readTodaysFights } from '@/lib/fightStore';
import { fightDate, isTraining } from '@/lib/fights';
import type { PlayerColor } from '@/types/game';
import PixelIcon, { WIZARD_ICON } from '@/components/PixelIcon';

// Easter egg page: only reachable by clicking a wizard on the landing page, and kept out of search engines.
export const metadata: Metadata = { title: 'Fight History — Wizards Fight', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NAME_COLOR: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

export default function HistoryPage() {
  const fights = readTodaysFights();

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 min-h-screen">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl md:text-5xl text-amber-400 text-center uppercase" style={{ textShadow: '4px 4px 0 #000' }}>
          Fight History
        </h1>
        <p className="text-gray-300 text-center mt-3 mb-10">
          {fights.length === 0
            ? 'No duels recorded today.'
            : `${fights.length} fight${fights.length === 1 ? '' : 's'} today, newest first. The chronicle starts over every day.`}
        </p>

        {fights.length === 0 ? (
          <div className="panel-stone text-center px-6 py-10">
            <div className="text-5xl mb-4"><PixelIcon name="scroll" /></div>
            <p className="text-gray-200">The chronicle is empty today. Finish a 3-round duel or a training session and it will be written here.</p>
          </div>
        ) : (
          <div className="panel-stone p-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Today&apos;s fights</caption>
              <thead>
                <tr className="font-pixel text-sm uppercase tracking-wider text-gray-400 border-b-4 border-gray-950">
                  <th scope="col" className="px-3 py-3">Date</th>
                  <th scope="col" className="px-3 py-3">Winner</th>
                  <th scope="col" className="px-3 py-3">Defeated</th>
                  <th scope="col" className="px-3 py-3 text-center">Score</th>
                  <th scope="col" className="px-3 py-3 text-center">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {fights.map((f) => isTraining(f) ? (
                  <tr key={f.id} className="border-b border-gray-800">
                    <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fightDate(f.at)}</td>
                    <td className={`px-3 py-3 font-pixel ${NAME_COLOR[f.player.color]}`}><PixelIcon name={WIZARD_ICON[f.player.color]} /> {f.player.name}</td>
                    <td className="px-3 py-3 text-gray-400 italic">Training</td>
                    <td className="px-3 py-3 text-center font-pixel text-gray-100">{f.solved} / {f.played}</td>
                    <td className="px-3 py-3 text-center font-pixel text-gray-100">{f.played}</td>
                  </tr>
                ) : (
                  <tr key={f.id} className="border-b border-gray-800">
                    <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{fightDate(f.at)}</td>
                    <td className={`px-3 py-3 font-pixel ${NAME_COLOR[f.winner.color]}`}>{f.draw ? <PixelIcon name={WIZARD_ICON[f.winner.color]} /> : <PixelIcon name="trophy" />} {f.winner.name}</td>
                    <td className={`px-3 py-3 ${NAME_COLOR[f.loser.color]}`}>{f.loser.name}{f.draw && <span className="block text-xs text-gray-400">Drawn game</span>}</td>
                    <td className="px-3 py-3 text-center font-pixel text-gray-100">
                      {f.score.winner} – {f.score.loser}
                      {f.draws > 0 && <span className="block text-xs text-gray-400 font-sans">{f.draws} draw{f.draws > 1 ? 's' : ''}</span>}
                    </td>
                    <td className="px-3 py-3 text-center font-pixel text-gray-100">{f.rounds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/" className="btn-pixel-secondary">← Back</Link>
        </div>
      </div>
    </main>
  );
}
