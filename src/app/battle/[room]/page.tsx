'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import QRPanel from '@/components/QRPanel';
import PlayerCard from '@/components/PlayerCard';
import Countdown from '@/components/Countdown';
import VictoryAnimation from '@/components/VictoryAnimation';
import BattleImage from '@/components/BattleImage';
import type { PlayerColor } from '@/types/game';

interface RoomData {
  id: string;
  state: string;
  players: Array<{ color: string; name: string; socketId: string }>;
  playerCount: number;
  maxPlayers: number;
}

interface BattleEndData {
  winnerColor: string | null;
  winnerName: string | null;
  durationMs: number | null;
  results: Record<string, { color: string; name: string; durationMs: number; correct: boolean }>;
  timedOut?: boolean;
}

export default function BattlePage({ params }: { params: { room: string } }) {
  const roomId = params.room;
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [battleEnd, setBattleEnd] = useState<BattleEndData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:watch', { roomId }, (res: { success: boolean; data?: RoomData; error?: string }) => {
        if (res.success && res.data) {
          setRoom(res.data);
        } else {
          setError(res.error || 'Failed to connect to room');
        }
      });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('room:update', (data: RoomData) => setRoom(data));
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
    socket.on('battle:end', (data: BattleEndData) => {
      setCountdown(null);
      setBattleEnd(data);
    });
    socket.on('player:disconnected', (data: { color: string; name: string }) => {
      setError(`${data.name} disconnected`);
      setTimeout(() => setError(null), 3000);
    });
    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    return () => { socket.disconnect(); };
  }, [roomId]);

  const roomUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play/${roomId}`
    : `/play/${roomId}`;

  const bluePlayer = room?.players.find((p) => p.color === 'blue');
  const redPlayer = room?.players.find((p) => p.color === 'red');
  const canStart = room?.state === 'waiting' && room?.playerCount === room?.maxPlayers;

  const blueResult = battleEnd ? Object.values(battleEnd.results).find((r) => r.color === 'blue') ?? null : null;
  const redResult = battleEnd ? Object.values(battleEnd.results).find((r) => r.color === 'red') ?? null : null;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 min-h-screen">
      {countdown !== null && <Countdown seconds={countdown} />}
      {battleEnd && (
        <VictoryAnimation
          winnerColor={(battleEnd.winnerColor as PlayerColor) ?? null}
          winnerName={battleEnd.winnerName}
          durationMs={battleEnd.durationMs}
          timedOut={battleEnd.timedOut}
        />
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
            <PlayerCard
              color="blue"
              name={bluePlayer?.name}
              joined={!!bluePlayer}
              connected={!battleEnd && !!bluePlayer}
              result={battleEnd ? blueResult : null}
              isWinner={battleEnd?.winnerColor === 'blue'}
            />
            <PlayerCard
              color="red"
              name={redPlayer?.name}
              joined={!!redPlayer}
              connected={!battleEnd && !!redPlayer}
              result={battleEnd ? redResult : null}
              isWinner={battleEnd?.winnerColor === 'red'}
            />
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

          {connected && room?.state === 'waiting' && room.playerCount < 2 && (
            <div className="text-gray-400 text-lg">
              <span className="text-amber-400 font-bold">{room.playerCount}/2</span> players connected — waiting for opponent
            </div>
          )}

          {canStart && !battleEnd && (
            <div className="text-amber-300 text-2xl font-bold animate-pulse uppercase tracking-wider">
              ⚔️ Starting Battle…
            </div>
          )}

          {room && (room.state === 'countdown' || room.state === 'playing') && !battleEnd && (
            <div className="text-amber-400 text-2xl font-bold animate-pulse">Battle in progress…</div>
          )}

          {battleEnd && (
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-10 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-xl transition-colors"
            >
              🔄 Play Again
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
