'use client';

import { useState, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import QRPanel from '@/components/QRPanel';
import PlayerCard from '@/components/PlayerCard';
import Countdown from '@/components/Countdown';
import VictoryAnimation from '@/components/VictoryAnimation';
import BattleImage from '@/components/BattleImage';
import ScoreTable from '@/components/ScoreTable';
import CopyLinkButton from '@/components/CopyLinkButton';
import TrainingSummary from '@/components/TrainingSummary';
import { MODE_LABELS } from '@/lib/modes';
import { roundLabel, drawReason, winDetail, trainingSummary, formatSeconds } from '@/lib/game';
import type { PlayerColor, BattleMode, BattleEnd, GameInfo, GameScore } from '@/types/game';

/** Where to send visitors of a room that no longer exists. The start page shows a notice for it. */
const ROOM_EXPIRED_URL = '/?expired=1';
/** How long the winner animation plays on the main screen before the scoreboard / waiting room. */
const ANIMATION_MS = 5000;

interface RoomData {
  id: string;
  state: string;
  mode: BattleMode | null;
  players: Array<{ color: PlayerColor; name: string; socketId: string; rematchReady: boolean; fightReady: boolean }>;
  playerCount: number;
  maxPlayers: number;
  game: GameInfo;
}

function namesFrom(results: BattleEnd['results']): Partial<Record<PlayerColor, string>> {
  return Object.fromEntries(Object.values(results).map((r) => [r.color, r.name]));
}

const scoreLine = (s: GameScore) => `${s.blue} – ${s.red}${s.draws ? ` (${s.draws} draw${s.draws > 1 ? 's' : ''})` : ''}`;

export default function BattlePage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomId } = use(params);
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  /** Result of the round that just ended; drives the animation and the between-rounds scoreboard. */
  const [battleEnd, setBattleEnd] = useState<BattleEnd | null>(null);
  const [animating, setAnimating] = useState(false);
  /** Shown in the waiting room after a game finished. */
  const [lastGame, setLastGame] = useState<{ label: string; color: PlayerColor; name: string; text: string } | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout>>();
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Also runs on every reconnect, e.g. after a server restart wiped the room.
      socket.emit('room:watch', { roomId }, (res: { success: boolean; data?: RoomData; error?: string; notFound?: boolean }) => {
        if (res.notFound) return window.location.replace(ROOM_EXPIRED_URL);
        if (res.success && res.data) {
          setRoom(res.data);
        } else {
          setError(res.error || 'Failed to connect to room');
        }
      });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('room:update', (data: RoomData) => {
      setRoom(data);
      // A new round is starting: clear the previous round's result.
      if (data.state === 'countdown') {
        setBattleEnd(null);
        setBattleStarted(false);
        setLastGame(null);
      }
      // Game cancelled (a player left mid-game): back to the plain waiting room.
      if (data.state === 'waiting' && data.game.results.length === 0) setBattleEnd(null);
    });
    socket.on('countdown', (data: { seconds: number }) => {
      setCountdown(data.seconds);
    });
    socket.on('fight', () => {
      setCountdown(null);
      setBattleStarted(true);
    });
    socket.on('spell:reveal', () => {
      setBattleStarted(true);
    });
    socket.on('battle:end', (data: BattleEnd) => {
      setCountdown(null);
      setBattleEnd(data);
      setAnimating(true);
      clearTimeout(animationTimer.current);
      animationTimer.current = setTimeout(() => {
        setAnimating(false);
        if (!data.game.over) return; // game goes on: the scoreboard stays until the next round
        // Game / training over: back to the waiting room, with the result kept as a banner.
        const names = namesFrom(data.results);
        if (data.game.training) {
          const player = Object.values(data.results)[0];
          const s = trainingSummary(data.game.results, data.game.times);
          setLastGame({
            label: 'Last training',
            color: player?.color ?? 'blue',
            name: player?.name ?? '',
            text: `solved ${s.solved}/${s.played}${s.best !== null ? `, best ${formatSeconds(s.best)}` : ''}`,
          });
        } else if (data.game.winner) {
          setLastGame({ label: 'Last game', color: data.game.winner, name: names[data.game.winner] ?? '', text: `won ${scoreLine(data.game.score)}` });
        }
        setBattleEnd(null);
        setBattleStarted(false);
      }, ANIMATION_MS);
    });
    socket.on('player:disconnected', (data: { color: string; name: string }) => {
      setError(`${data.name} left the room`);
      setTimeout(() => setError(null), 3000);
    });
    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      clearTimeout(animationTimer.current);
      socket.disconnect();
    };
  }, [roomId]);

  const roomUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play/${roomId}`
    : `/play/${roomId}`;

  const bluePlayer = room?.players.find((p) => p.color === 'blue');
  const redPlayer = room?.players.find((p) => p.color === 'red');
  const canStart = room?.state === 'waiting' && room?.playerCount === room?.maxPlayers;
  const game = room?.game;
  const gameOverWaiting = room?.state === 'ended' && !!game?.over && !battleEnd;
  const training = !!game?.training;

  const playUrl = (c: string) => typeof window !== 'undefined' ? `${window.location.origin}/play/${roomId}?color=${c}` : '';

  const resultFor = (c: PlayerColor) => (battleEnd ? Object.values(battleEnd.results).find((r) => r.color === c) ?? null : null);

  const endTitle = (end: BattleEnd) => {
    const label = roundLabel(end.game.round, end.game.training);
    if (end.game.training) return end.winnerColor ? `${label} — solved by` : label;
    if (end.game.winner) return 'The winner of the game is';
    return end.winnerColor ? `${label} goes to` : label;
  };

  const endSubtitle = (end: BattleEnd) => {
    if (end.game.training) {
      const s = trainingSummary(end.game.results, end.game.times);
      return `Solved ${s.solved}/${s.played}${s.best !== null ? ` · best ${formatSeconds(s.best)}` : ''}`;
    }
    return `${winDetail(end) ? `${winDetail(end)} · ` : ''}Score ${scoreLine(end.game.score)}`;
  };


  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 min-h-screen">
      {countdown !== null && (
        <Countdown
          seconds={countdown}
          label={game && room?.mode ? `${roundLabel(game.round, game.training)} · ${MODE_LABELS[room.mode]}` : undefined}
        />
      )}

      {battleEnd && animating && (
        <VictoryAnimation
          winnerColor={battleEnd.game.winner ?? battleEnd.winnerColor}
          winnerName={battleEnd.game.winner ? namesFrom(battleEnd.results)[battleEnd.game.winner] ?? null : battleEnd.winnerName}
          title={endTitle(battleEnd)}
          subtitle={endSubtitle(battleEnd)}
          durationMs={battleEnd.game.winner ? null : battleEnd.durationMs}
          drawReason={drawReason(battleEnd)}
          drawLabel={battleEnd.game.training ? 'FAILED' : 'DRAW'}
        />
      )}

      {/* Training between rounds: the training summary until the wizard presses Next round. */}
      {battleEnd && !animating && !battleEnd.game.over && battleEnd.game.training && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a0a1a]/95 px-4 animate-fade-in">
          <div className="w-full max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-amber-400 mb-2">
              {roundLabel(battleEnd.game.round, true)}
            </h2>
            <p className="text-gray-300 text-xl mb-8">
              {Object.values(battleEnd.results)[0]?.name}{' '}
              {battleEnd.winnerColor && battleEnd.durationMs !== null
                ? `solved it in ${formatSeconds(battleEnd.durationMs)}`
                : `failed — ${drawReason(battleEnd).toLowerCase()}`}
            </p>
            <TrainingSummary results={battleEnd.game.results} times={battleEnd.game.times} large />
            <p className="text-gray-400 text-lg mt-8 animate-pulse">Next round starts when the wizard presses Next round…</p>
          </div>
        </div>
      )}

      {/* Between rounds: the score until both wizards press Next round. */}
      {battleEnd && !animating && !battleEnd.game.over && !battleEnd.game.training && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a0a1a]/95 px-4 animate-fade-in">
          <div className="w-full max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-amber-400 mb-2">
              After {roundLabel(battleEnd.game.round).replace(' · Extra round', '')}
            </h2>
            <p className="text-gray-300 text-xl mb-8">
              {battleEnd.winnerColor ? `${battleEnd.winnerName} won the round${winDetail(battleEnd) ? ` (${winDetail(battleEnd)!.toLowerCase()})` : ""}` : `Draw — ${drawReason(battleEnd).toLowerCase()}`}
            </p>
            <ScoreTable names={namesFrom(battleEnd.results)} score={battleEnd.game.score} results={battleEnd.game.results} large />
            <p className="text-gray-400 text-lg mt-8 animate-pulse">Next round starts when both wizards press Next round on their phones…</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-600 mx-1">vs</span>
            <span className="text-red-400">Wizards</span>
            <span className="text-amber-400 ml-2">⚔️</span>
          </h1>
          <div className="text-gray-500 text-sm mt-2 font-mono flex items-center justify-center gap-2">
            <span>Room:</span>
            <span className="text-amber-400 font-bold">{roomId}</span>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-gray-600">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>

        {lastGame && (
          <div role="status" className={`mb-6 mx-auto max-w-xl text-center px-4 py-3 rounded-xl border bg-amber-500/10 border-amber-500/40`}>
            <span className="text-gray-300">{lastGame.label}: </span>
            <span className={`font-black ${lastGame.color === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{lastGame.name}</span>
            <span className="text-gray-300"> {lastGame.text}</span>
          </div>
        )}

        {training && (
          <div role="status" className="mb-6 mx-auto max-w-xl text-center px-4 py-3 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-200 font-bold">
            🧙 Training — room closed to new players
          </div>
        )}

        <div className="mb-8">
          <BattleImage
            blueJoined={!!bluePlayer}
            redJoined={!!redPlayer}
            countdown={countdown}
            battleStarted={battleStarted}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center">
          <div className="flex flex-col items-center gap-4">
            <QRPanel roomUrl={roomUrl} />
            <div className="text-center">
              <p className="text-gray-400 text-sm font-medium">Scan with your phone to join the fight</p>
              <p className="text-gray-600 text-xs font-mono mt-1 break-all">
                {roomUrl}
                <CopyLinkButton url={roomUrl} />
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            {(['blue', 'red'] as const).map((c) => {
              const player = c === 'blue' ? bluePlayer : redPlayer;
              return (
                <PlayerCard
                  key={c}
                  color={c}
                  name={player?.name}
                  joined={!!player}
                  connected={!battleEnd && !!player}
                  result={resultFor(c)}
                  isWinner={battleEnd?.winnerColor === c}
                  wins={game && !gameOverWaiting ? game.score[c] : 0}
                  joinUrl={!player ? playUrl(c) : undefined}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-10 text-center">
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 inline-block">
              {error}
            </div>
          )}

          {!connected && (
            <div className="text-gray-500 text-lg animate-pulse">Connecting…</div>
          )}

          {connected && room && !training && (room.state === 'waiting' || gameOverWaiting) && room.playerCount < 2 && (
            <div className="text-gray-400 text-lg">
              <span className="text-amber-400 font-bold">{room.playerCount}/2</span> players connected — waiting for opponent
            </div>
          )}

          {canStart && !battleEnd && (
            room.players.every((p) => p.fightReady) ? (
              <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider animate-pulse">⚔️ Both wizards ready — battle starting…</div>
            ) : (
              <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
                ⚔️ Both wizards present — press <span className="text-amber-400 underline">Let&apos;s Fight</span> on each phone
              </div>
            )
          )}

          {gameOverWaiting && !training && room.playerCount === 2 && (
            <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
              Game over — press <span className="text-amber-400 underline">Fight again</span> on both phones for a new game
            </div>
          )}

          {gameOverWaiting && training && (
            <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
              Training finished — <span className="text-amber-400 underline">Train again</span> or <span className="text-amber-400 underline">Stop training</span> on the phone
            </div>
          )}

          {training && room?.state === 'waiting' && (
            <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider animate-pulse">🧙 Training round starting…</div>
          )}

          {room && game && (room.state === 'countdown' || room.state === 'playing') && !battleEnd && (
            <div className="text-amber-400 text-2xl font-bold animate-pulse">
              {training ? 'Training' : 'Battle'} in progress — {roundLabel(game.round, game.training)}{room.mode ? ` · ${MODE_LABELS[room.mode]}` : ''}…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
