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
import { MODE_LABELS } from '@/lib/modes';
import { roundLabel, drawReason, winDetail } from '@/lib/game';
import { TEAMS, MAX_TEAM_SIZE, bothTeamsPresent, teamNames } from '@/lib/teams';
import type { PlayerColor, BattleMode, BattleEnd, GameInfo, GameScore } from '@/types/game';
import PixelIcon from '@/components/PixelIcon';
import BattleMusic from '@/components/BattleMusic';

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

/** Team names ("Merlin & Ana") per color, from a round's results. */
const namesFrom = (results: BattleEnd['results']) => teamNames(Object.values(results));

const scoreLine = (s: GameScore) => `${s.blue} – ${s.red}${s.draws ? ` (${s.draws} draw${s.draws > 1 ? 's' : ''})` : ''}`;

export default function BattlePage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomId } = use(params);
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  /** Result of the round that just ended; drives the animation and the between-rounds scoreboard. */
  const [battleEnd, setBattleEnd] = useState<BattleEnd | null>(null);
  const [animating, setAnimating] = useState(false);
  /** The game that just finished: its result stays on screen until the wizards press Fight again or quit. */
  const [finalEnd, setFinalEnd] = useState<BattleEnd | null>(null);
  /** Shown in the waiting room after a game finished (no color for a drawn game). */
  const [lastGame, setLastGame] = useState<{ label: string; color?: PlayerColor; name: string; text: string } | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout>>();
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);
  // Read after the first render: the server has no window, and the first browser render must match its HTML.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

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
        setFinalEnd(null);
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
        // Game over: the final result stays up; once a team is empty the waiting room shows it as a banner.
        const names = namesFrom(data.results);
        setLastGame(data.game.winner
          ? { label: 'Last game', color: data.game.winner, name: names[data.game.winner] ?? '', text: `won ${scoreLine(data.game.score)}` }
          : { label: 'Last game', name: '', text: `drawn ${scoreLine(data.game.score)}` });
        setFinalEnd(data);
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
    // Another main screen watching this room closed it.
    socket.on('room:closed', () => window.location.replace(ROOM_EXPIRED_URL));

    return () => {
      clearTimeout(animationTimer.current);
      socket.disconnect();
    };
  }, [roomId]);

  // "Exit room": closes the room for everyone (phones go to the start page) and returns this screen to Start Fight.
  const closeRoom = () => {
    const socket = socketRef.current;
    if (!socket?.connected) return window.location.assign('/');
    socket.emit('room:close', { roomId }, (res: { success: boolean; error?: string }) => {
      if (res.success) return window.location.assign('/');
      setError(res.error || 'Could not close the room');
    });
  };

  const roomUrl = `${origin}/play/${roomId}`;

  const members = (c: PlayerColor) => room?.players.filter((p) => p.color === c) ?? [];
  const teamsPresent = bothTeamsPresent(room?.players ?? []);
  const canStart = room?.state === 'waiting' && teamsPresent;
  const readyCount = room?.players.filter((p) => p.fightReady).length ?? 0;
  const game = room?.game;
  const gameOverWaiting = room?.state === 'ended' && !!game?.over && !battleEnd;

  const playUrl = (c: string) => `${origin}/play/${roomId}?color=${c}`;

  const resultFor = (c: PlayerColor) => (battleEnd ? Object.values(battleEnd.results).find((r) => r.color === c) ?? null : null);
  const wizards = (n: number) => `${n} wizard${n === 1 ? '' : 's'}`;

  const endTitle = (end: BattleEnd) => {
    const label = roundLabel(end.game.round);
    if (end.game.winner) return 'The winner of the game is';
    if (end.game.over) return 'Game over after 3 rounds';
    return end.winnerColor ? `${label} goes to` : label;
  };

  const endSubtitle = (end: BattleEnd) => {
    return `${winDetail(end) ? `${winDetail(end)} · ` : ''}Score ${scoreLine(end.game.score)}`;
  };


  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 min-h-screen">
      <BattleMusic />
      {countdown !== null && (
        <Countdown
          seconds={countdown}
          label={game && room?.mode ? `${roundLabel(game.round)} · ${MODE_LABELS[room.mode]}` : undefined}
        />
      )}

      {battleEnd && animating && (
        <VictoryAnimation
          winnerColor={battleEnd.game.over ? battleEnd.game.winner : battleEnd.winnerColor}
          winnerName={battleEnd.game.over ? (battleEnd.game.winner && namesFrom(battleEnd.results)[battleEnd.game.winner]) || null : battleEnd.winnerName}
          title={endTitle(battleEnd)}
          subtitle={endSubtitle(battleEnd)}
          durationMs={battleEnd.game.winner || battleEnd.mode === 'math' ? null : battleEnd.durationMs}
          drawReason={battleEnd.game.over ? 'Same number of round wins — nobody takes the game' : drawReason(battleEnd)}
          drawLabel={battleEnd.game.over ? 'DRAW GAME' : 'DRAW'}
        />
      )}

      {/* Game over: the final result until the wizards press Fight again (new game) or Quit (empties a team → waiting room). */}
      {finalEnd && gameOverWaiting && teamsPresent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/95 px-4 animate-fade-in">
          <div className="w-full max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-amber-400 mb-2">Game over</h2>
            {finalEnd.game.winner ? (
              <p className="text-2xl md:text-3xl mb-8">
                <PixelIcon name="trophy" />{' '}
                <span className={`font-black ${finalEnd.game.winner === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{namesFrom(finalEnd.results)[finalEnd.game.winner]}</span>
                <span className="text-gray-300"> wins the game</span>
              </p>
            ) : (
              <p className="text-2xl md:text-3xl text-gray-300 mb-8">Drawn game — same number of round wins</p>
            )}
            <ScoreTable names={namesFrom(finalEnd.results)} score={finalEnd.game.score} results={finalEnd.game.results} winner={finalEnd.game.winner} large />
            <p className="text-gray-400 text-lg mt-8 animate-pulse">
              Choose on your phone: <span className="text-amber-400">Fight again</span> or <span className="text-amber-400">Quit</span>
            </p>
          </div>
        </div>
      )}

      {/* Between rounds: the score until every wizard presses Next round. */}
      {battleEnd && !animating && !battleEnd.game.over && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/95 px-4 animate-fade-in">
          <div className="w-full max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-amber-400 mb-2">
              After {roundLabel(battleEnd.game.round)}
            </h2>
            <p className="text-gray-300 text-xl mb-8">
              {battleEnd.winnerColor ? `${battleEnd.winnerName} won the round${winDetail(battleEnd) ? ` (${winDetail(battleEnd)!.toLowerCase()})` : ""}` : `Draw — ${drawReason(battleEnd).toLowerCase()}`}
            </p>
            <ScoreTable names={namesFrom(battleEnd.results)} score={battleEnd.game.score} results={battleEnd.game.results} large />
            <p className="text-gray-400 text-lg mt-8 animate-pulse">Next round starts when every wizard presses Next round on their phone…</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="flex flex-wrap justify-center items-center gap-x-3 text-3xl md:text-5xl font-black uppercase" style={{ textShadow: "4px 4px 0 #000" }}>
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-600 mx-1">vs</span>
            <span className="text-red-400">Wizards</span>
            <span className="text-amber-400 ml-2"><PixelIcon name="swords" /></span>
          </h1>
          <div className="text-gray-500 text-sm mt-2 font-mono flex items-center justify-center gap-2">
            <span>Room:</span>
            <span className="text-amber-400 font-bold">{roomId}</span>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-gray-600">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
          <button onClick={closeRoom} className="btn-pixel-secondary mt-6 text-sm">
            <PixelIcon name="door" /> Exit room
          </button>
        </div>

        {lastGame && (
          <div role="status" className="panel-stone mb-8 mx-auto max-w-xl text-center px-4 py-3">
            <span className="text-gray-300">{lastGame.label}: </span>
            {lastGame.color && <span className={`font-black ${lastGame.color === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{lastGame.name}</span>}
            <span className="text-gray-300"> {lastGame.text}</span>
          </div>
        )}

        <div className="mb-8">
          <BattleImage
            blueNames={members('blue').map((p) => p.name)}
            redNames={members('red').map((p) => p.name)}
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
            {TEAMS.map((c) => {
              const team = members(c);
              return (
                <PlayerCard
                  key={c}
                  color={c}
                  members={team.map((p) => ({ name: p.name, ready: room?.state === 'waiting' && p.fightReady }))}
                  connected={!battleEnd && team.length > 0}
                  result={resultFor(c)}
                  isWinner={battleEnd?.winnerColor === c}
                  wins={game && !gameOverWaiting ? game.score[c] : 0}
                  joinUrl={room?.state === 'waiting' && team.length < MAX_TEAM_SIZE ? playUrl(c) : undefined}
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

          {connected && room && (room.state === 'waiting' || gameOverWaiting) && !teamsPresent && (
            <div className="text-gray-400 text-lg">
              <span className="text-amber-400 font-bold">{wizards(room.playerCount)}</span> connected — waiting for a wizard on each team (up to {room.maxPlayers})
            </div>
          )}

          {canStart && !battleEnd && (
            readyCount === room.playerCount ? (
              <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider animate-pulse"><PixelIcon name="swords" /> Every wizard ready — battle starting…</div>
            ) : (
              <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
                <PixelIcon name="swords" /> {readyCount}/{room.playerCount} ready — press <span className="text-amber-400 underline">Let&apos;s Fight</span> on every phone
              </div>
            )
          )}

          {gameOverWaiting && teamsPresent && (
            <div className="text-amber-300 text-2xl font-bold uppercase tracking-wider">
              Game over — press <span className="text-amber-400 underline">Fight again</span> on every phone for a new game
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
