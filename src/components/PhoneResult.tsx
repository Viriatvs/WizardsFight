'use client';

import ScoreTable from '@/components/ScoreTable';
import { VICTORY_GIF } from '@/components/VictoryAnimation';
import { roundLabel } from '@/lib/game';
import type { BattleEnd, PlayerColor } from '@/types/game';

interface PhoneResultProps {
  end: BattleEnd;
  myColor: PlayerColor | null;
  /** This player already pressed Next round / Fight again. */
  waiting: boolean;
  opponentPresent: boolean;
  onContinue: () => void;
  onExit: () => void;
  error?: string | null;
}

const COLOR_TEXT: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

/** Phone screen after a round (score + Next round) or after the game (animation + final table + Fight again). */
export default function PhoneResult({ end, myColor, waiting, opponentPresent, onContinue, onExit, error }: PhoneResultProps) {
  const names = Object.fromEntries(Object.values(end.results).map((r) => [r.color, r.name])) as Partial<Record<PlayerColor, string>>;
  const gameWinner = end.game.winner;
  const gameOver = !!gameWinner;
  const continueLabel = gameOver ? 'Fight again' : 'Next round';

  return (
    <div className="text-center py-4">
      {gameOver ? (
        <>
          {/* The whole animation fits the phone (object-contain), with the winner's name over it. */}
          <div className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-black">
            <img src={VICTORY_GIF[gameWinner]} alt={`${gameWinner} wizard victory`} className="w-full h-auto max-h-[50vh] object-contain mx-auto" />
            <div className="absolute inset-x-0 top-0 px-3 pt-3 pb-8 bg-gradient-to-b from-black/85 to-transparent">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-200">Winner of the game</div>
              <div
                className={`text-3xl font-black break-words ${COLOR_TEXT[gameWinner]}`}
                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}
              >
                {names[gameWinner] || (gameWinner === 'blue' ? 'Blue Wizard' : 'Red Wizard')}
              </div>
            </div>
          </div>
          <div className={`text-2xl font-black mt-4 ${myColor === gameWinner ? 'text-amber-400 animate-bounce' : 'text-gray-400'}`}>
            {myColor === gameWinner ? '🎉 You win the game! 🎉' : 'You lost the game'}
          </div>
        </>
      ) : (
        <>
          <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{roundLabel(end.game.round)}</div>
          {end.winnerColor ? (
            <>
              <div className={`text-4xl font-black break-words ${COLOR_TEXT[end.winnerColor]}`}>{end.winnerName}</div>
              <div className="text-gray-300 text-lg mt-1">wins the round</div>
              <div className={`text-xl font-bold mt-3 ${myColor === end.winnerColor ? 'text-amber-400' : 'text-gray-500'}`}>
                {myColor === end.winnerColor ? '🎉 Round won!' : 'Round lost'}
              </div>
              {end.durationMs !== null && <div className="text-gray-400 font-mono mt-2">⚡ {end.durationMs.toLocaleString()} ms</div>}
              {end.graceTimeout && <p className="text-gray-400 text-sm mt-1">Opponent did not cast in time</p>}
              {end.forfeit && <p className="text-gray-400 text-sm mt-1">Opponent left the battle</p>}
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">💀</div>
              <div className="text-3xl font-black text-gray-400">DRAW</div>
              <p className="text-gray-500 mt-1">{end.allWrong ? 'Both wizards chose wrong' : 'No valid spell cast in time'}</p>
            </>
          )}
        </>
      )}

      <div className="mt-6">
        <ScoreTable names={names} score={end.game.score} results={end.game.results} winner={gameWinner} />
      </div>

      {gameOver && !opponentPresent && <p className="text-gray-400 text-sm mt-4">Your opponent left the room.</p>}

      {waiting ? (
        <p className="text-amber-300 font-bold mt-8 animate-pulse">Waiting for your opponent to press {continueLabel}…</p>
      ) : (
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={onContinue}
            className="min-h-[44px] px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
          >
            ⚔️ {continueLabel}
          </button>
          <button
            onClick={onExit}
            className="min-h-[44px] px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
          >
            Exit
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}
