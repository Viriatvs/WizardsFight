'use client';

import ScoreTable from '@/components/ScoreTable';
import { VICTORY_GIF } from '@/components/VictoryAnimation';
import TrainingSummary from '@/components/TrainingSummary';
import { roundLabel, drawReason, winDetail, formatSeconds } from '@/lib/game';
import { teamNames } from '@/lib/teams';
import type { BattleEnd, PlayerColor } from '@/types/game';
import PixelIcon from '@/components/PixelIcon';

interface PhoneResultProps {
  end: BattleEnd;
  myColor: PlayerColor | null;
  /** This player already pressed Next round / Fight again. */
  waiting: boolean;
  opponentPresent: boolean;
  onContinue: () => void;
  onExit: () => void;
  /** Training only: ends the session (saved to the history) and deletes the room. */
  onStopTraining: () => void;
  error?: string | null;
}

const COLOR_TEXT: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

/** Training alone: Solved/Failed for the round and the session so far; goes on until the wizard quits. */
function TrainingResult({ end, onContinue, onStopTraining, error }: Omit<PhoneResultProps, 'myColor' | 'waiting' | 'opponentPresent'>) {
  return (
    <div className="text-center py-4">
      <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">{roundLabel(end.game.round, true)}</div>
      {end.winnerColor ? (
        <>
          <div className="text-4xl font-black text-emerald-400">✓ Solved</div>
          {winDetail(end)
            ? <div className="text-gray-300 font-mono mt-2">{winDetail(end)}</div>
            : end.durationMs !== null && <div className="text-gray-300 font-mono mt-2"><PixelIcon name="bolt" /> {formatSeconds(end.durationMs)}</div>}
        </>
      ) : (
        <>
          <div className="text-4xl font-black text-red-400">✗ Failed</div>
          <p className="text-gray-400 mt-1">{drawReason(end)}</p>
        </>
      )}

      <div className="mt-6">
        <TrainingSummary results={end.game.results} times={end.game.times} />
      </div>

      <div className="mt-8 flex flex-wrap gap-5 justify-center">
        <button onClick={onContinue} className="btn-pixel"><PixelIcon name="swords" /> Next round</button>
        <button onClick={onStopTraining} className="btn-pixel-secondary">Quit training</button>
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}

/** Phone screen after a round (score + Next round) or after the game (animation + final table + Fight again). */
export default function PhoneResult(props: PhoneResultProps) {
  const { end, myColor, waiting, opponentPresent, onContinue, onExit, error } = props;
  if (end.game.training) return <TrainingResult {...props} />;

  const names = teamNames(Object.values(end.results));
  const teamMode = Object.keys(end.results).length > 2;
  const others = teamMode ? 'the other team' : 'your opponent';
  const gameWinner = end.game.winner;
  const gameOver = end.game.over;
  const continueLabel = gameOver ? 'Fight again' : 'Next round';

  return (
    <div className="text-center py-4">
      {gameOver && !gameWinner ? (
        <>
          <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Game over after 3 rounds</div>
          <div className="text-4xl font-black text-gray-300">DRAW GAME</div>
          <p className="text-gray-400 mt-1">Same number of round wins — nobody takes the game</p>
        </>
      ) : gameOver && gameWinner ? (
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
            {myColor === gameWinner ? <><PixelIcon name="sparkle" /> {teamMode ? 'Your team wins' : 'You win'} the game! <PixelIcon name="sparkle" /></> : `${teamMode ? 'Your team' : 'You'} lost the game`}
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
                {myColor === end.winnerColor ? <><PixelIcon name="sparkle" /> {teamMode ? 'Your team won the round!' : 'Round won!'}</> : 'Round lost'}
              </div>
              {end.durationMs !== null && <div className="text-gray-400 font-mono mt-2"><PixelIcon name="bolt" /> {end.durationMs.toLocaleString()} ms</div>}
              {end.graceTimeout && <p className="text-gray-400 text-sm mt-1">{teamMode ? 'The others' : 'Opponent'} did not cast in time</p>}
              {end.forfeit && <p className="text-gray-400 text-sm mt-1">{teamMode ? 'The other team' : 'Opponent'} left the battle</p>}
              {winDetail(end) && <p className="text-gray-300 font-mono mt-2">{winDetail(end)}</p>}
            </>
          ) : (
            <>
              <div className="text-4xl mb-2"><PixelIcon name="skull" /></div>
              <div className="text-3xl font-black text-gray-400">DRAW</div>
              <p className="text-gray-500 mt-1">{drawReason(end)}</p>
            </>
          )}
        </>
      )}

      <div className="mt-6">
        <ScoreTable names={names} score={end.game.score} results={end.game.results} winner={gameWinner} />
      </div>

      {gameOver && !opponentPresent && <p className="text-gray-400 text-sm mt-4">{others[0].toUpperCase() + others.slice(1)} left the room.</p>}

      {waiting ? (
        <>
          <p className="text-amber-300 font-bold mt-8 animate-pulse">Waiting for {teamMode ? 'the other wizards' : 'your opponent'} to press {continueLabel}…</p>
          {/* After the game you can still change your mind and leave. */}
          {gameOver && <button onClick={onExit} className="btn-pixel-secondary mt-5">Quit</button>}
        </>
      ) : (
        <div className="mt-8 flex flex-wrap gap-5 justify-center">
          <button onClick={onContinue} className="btn-pixel">
            <PixelIcon name="swords" /> {continueLabel}
          </button>
          <button onClick={onExit} className="btn-pixel-secondary">
            {gameOver ? 'Quit' : 'Exit'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}
