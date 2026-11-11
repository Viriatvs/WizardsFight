'use client';

import { useState, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import QRPanel from '@/components/QRPanel';
import PlayerCard from '@/components/PlayerCard';
import Countdown from '@/components/Countdown';
import VictoryAnimation from '@/components/VictoryAnimation';
import BattleImage from '@/components/BattleImage';
import ScoreTable from '@/components/ScoreTable';
import { MODE_LABELS } from '@/lib/modes';
import { roundLabel, drawReason } from '@/lib/game';
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
  const [lastGame, setLastGame] = useState<{ winnerName: string; winnerColor: PlayerColor; score: GameScore } | null>(null);
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
        const winner = data.game.winner;
        if (!winner) return; // game goes on: the scoreboard stays until the next round
        // Game over: back to the waiting room, with the result kept as a banner.
        setLastGame({ winnerColor: winner, winnerName: namesFrom(data.results)[winner] ?? '', score: data.game.score });
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
  const gameOverWaiting = room?.state === 'ended' && !!game?.winner && !battleEnd;

  const playUrl = (c: string) => typeof window !== 'undefined' ? `${window.location.origin}/play/${roomId}?color=${c}` : '';

  const resultFor = (c: PlayerColor) => (battleEnd ? Object.values(battleEnd.results).find((r) => r.color === c) ?? null : null);

  const endTitle = (end: BattleEnd) => {
    if (end.game.winner) return 'The winner of the game is';
    return end.winnerColor ? `${roundLabel(end.game.round)} goes to` : roundLabel(end.game.round);
  };


  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 min-h-screen">
      {countdown !== null && (
        <Countdown
          seconds={countdown}
          label={game && room?.mode ? `${roundLabel(game.round)} · ${MODE_LABELS[room.mode]}` : undefined}
        />
      )}

      {battleEnd && animating && (
        <VictoryAnimation
          winnerColor={battleEnd.game.winner ?? battleEnd.winnerColor}
          winnerName={battleEnd.game.winner ? namesFrom(battleEnd.results)[battleEnd.game.winner] ?? null : battleEnd.winnerName}
          title={endTitle(battleEnd)}
          subtitle={`Score ${scoreLine(battleEnd.game.score)}`}
          durationMs={battleEnd.game.winner ? null : battleEnd.durationMs}
          drawReason={drawReason(battleEnd)}
        />
      )}

      {/* Between rounds: the score until both wizards press Next round. */}
      {battleEnd && !animating && !battleEnd.game.winner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a0a1a]/95 px-4 animate-fade-in">
          <div className="w-full max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-amber-400 mb-2">
              After {roundLabel(battleEnd.game.round).replace(' · Extra round', '')}
            </h2>
            <p className="text-gray-300 text-xl mb-8">
              {battleEnd.winnerColor ? `${battleEnd.winnerName} won the round` : `Draw — ${drawReason(battleEnd).toLowerCase()}`}
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
            <span className="text-gray-300">Last game: </span>
            <span className={`font-black ${lastGame.winnerColor === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{lastGame.winnerName}</span>
            <span className="text-gray-300"> won {scoreLine(lastGame.score)}</span>
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
              <p className="text-gray-600 text-xs font-mono mt-1 break-all">{roomUrl}</p>
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

          {connected && room && (room.state === 'waiting' || gameOverWaiting) && room.playerCount < 2 && (
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

          {gameOverWaiting && room.playerCount === 2 && (
            <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
              Game over — press <span className="text-amber-400 underline">Fight again</span> on both phones for a new game
            </div>
          )}

          {room && game && (room.state === 'countdown' || room.state === 'playing') && !battleEnd && (
            <div className="text-amber-400 text-2xl font-bold animate-pulse">
              Battle in progress — {roundLabel(game.round)}{room.mode ? ` · ${MODE_LABELS[room.mode]}` : ''}…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
