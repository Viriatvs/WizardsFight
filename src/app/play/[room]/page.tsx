'use client';

import { useState, useCallback, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import Countdown from '@/components/Countdown';
import SpellInput from '@/components/SpellInput';
import type { PlayerColor, GamePhase, SpellData } from '@/types/game';

export default function PlayPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomId } = use(params);
  const socketRef = useRef<Socket | null>(null);

  const [phase, setPhase] = useState<GamePhase>('connecting');
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [wins, setWins] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFight, setShowFight] = useState(false);
  const [spell, setSpell] = useState<SpellData | null>(null);
  const [spellRevealedAt, setSpellRevealedAt] = useState(0);
  const [submitted, setSubmitted] = useState<{ correct: boolean; durationMs: number } | null>(null);
  const [graceSeconds, setGraceSeconds] = useState<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [battleEnd, setBattleEnd] = useState<{
    winnerColor: string | null;
    winnerName: string | null;
    durationMs: number | null;
    results: Record<string, { color: string; name: string; durationMs: number; correct: boolean }>;
    timedOut?: boolean;
    graceTimeout?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', { roomId }, (res: { success: boolean; color?: PlayerColor; error?: string }) => {
        if (res.success && res.color) {
          setColor(res.color);
          setPhase('waiting');
        } else {
          setError(res.error || 'Failed to join');
          setPhase('ended');
        }
      });
    });

    socket.on('room:update', (data: { state: string; players: Array<{ color: string; wins: number }> }) => {
      if (data.state === 'countdown') setPhase('countdown');
      if (data.state === 'playing') setPhase('spell');
      if (data.state === 'waiting') {
        setPhase('waiting');
        setSubmitted(null);
        setSpell(null);
        setGraceSeconds(null);
        setBattleEnd(null);
      }
      if (color) {
        const me = data.players.find((p) => p.color === color);
        if (me) setWins(me.wins);
      }
    });

    socket.on('countdown', (data: { seconds: number }) => {
      setCountdown(data.seconds);
      setPhase('countdown');
    });

    socket.on('fight', () => {
      setCountdown(null);
      setShowFight(true);
      setTimeout(() => setShowFight(false), 1000);
    });

    socket.on('spell:reveal', (data: { spell: SpellData; revealedAt: number }) => {
      setCountdown(null);
      setSpell(data.spell);
      setSpellRevealedAt(data.revealedAt);
      setPhase('spell');
    });

    socket.on('spell:submitted', (data: { correct: boolean; durationMs: number }) => {
      if (!data.correct) {
        setSubmitted({ correct: false, durationMs: data.durationMs });
        setTimeout(() => setSubmitted(null), 2000);
      } else {
        setSubmitted({ correct: true, durationMs: data.durationMs });
      }
    });

    socket.on('grace', (data: { seconds: number }) => {
      setGraceSeconds(data.seconds);
      let remaining = data.seconds;
      graceTimerRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(graceTimerRef.current);
          setGraceSeconds(0);
        } else {
          setGraceSeconds(remaining);
        }
      }, 1000);
    });

    socket.on('battle:end', (data: typeof battleEnd & { wins?: Record<string, number> }) => {
      setCountdown(null);
      setGraceSeconds(null);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      if (data.wins && color) setWins(data.wins[color] ?? 0);
      setBattleEnd(data);
      setPhase('ended');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('disconnect', () => {
      setError('Disconnected from server');
      setPhase('ended');
    });

    return () => { socket.disconnect(); };
  }, [roomId]);

  const submitSpell = useCallback((text: string) => {
    socketRef.current?.emit('spell:submit', { roomId, text });
  }, [roomId]);

  const colorClass = color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
  const colorBg = color === 'blue' ? 'bg-blue-500/10 border-blue-500' : color === 'red' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500';

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-6">
      {countdown !== null && <Countdown seconds={countdown} />}

      {showFight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div
            className="text-8xl md:text-[10rem] font-black text-amber-300 battle-text select-none leading-none"
            style={{
              textShadow: '0 0 60px rgba(245,158,11,0.9), 0 0 120px rgba(245,158,11,0.5), 0 0 200px rgba(239,68,68,0.3)',
            }}
          >
            FIGHT!
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight">
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-500 mx-1">vs</span>
            <span className="text-red-400">Wizards</span>
          </h1>
          {color && (
            <div className={`inline-block mt-2 px-4 py-1 rounded-full border ${colorBg}`}>
              <span className={`font-bold text-sm uppercase tracking-wider ${colorClass}`}>
                You are {color === 'blue' ? '🔵 Blue' : '🔴 Red'}
              </span>
            </div>
          )}
        </div>

        {phase === 'connecting' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 animate-spin inline-block">⏳</div>
            <p className="text-gray-400 text-lg">Connecting to battle…</p>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4 animate-bounce inline-block">🧙</div>
            <p className="text-gray-300 text-lg font-medium">Battle will start soon…</p>
            <p className="text-gray-500 text-sm mt-2">Waiting for players on the host screen</p>
          </div>
        )}

        {phase === 'spell' && spell && (
          <SpellInput
            spell={spell}
            spellRevealedAt={spellRevealedAt}
            onSubmit={submitSpell}
            submitted={submitted}
            graceSeconds={graceSeconds}
          />
        )}

        {battleEnd && (
          <div className="text-center py-8">
            {battleEnd.timedOut || !battleEnd.winnerColor ? (
              <>
                <div className="text-5xl mb-4">💀</div>
                <div className="text-3xl font-black text-gray-400">DRAW</div>
                <p className="text-gray-500 mt-2">No valid spell cast</p>
              </>
            ) : (
              <>
                <img
                  src={battleEnd.winnerColor === 'blue' ? '/images/victory-blue-wizard.gif' : '/images/victory-red-wizard.gif'}
                  alt={`${battleEnd.winnerColor} wizard victory`}
                  className="fixed inset-0 w-full h-full object-cover -z-10"
                />
                <div className={`text-4xl font-black ${battleEnd.winnerColor === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                  {battleEnd.winnerColor === 'blue' ? 'BLUE' : 'RED'} WINS!
                </div>
                <p className="text-gray-300 text-xl mt-2">{battleEnd.winnerName}</p>
                {color === battleEnd.winnerColor && (
                  <div className="text-amber-400 text-2xl font-bold mt-4 animate-bounce">
                    🎉 YOU WIN! 🎉
                  </div>
                )}
                {color !== battleEnd.winnerColor && (
                  <div className="text-gray-500 text-lg mt-4">Better luck next time…</div>
                )}
                {battleEnd.durationMs !== null && (
                  <div className="text-gray-400 font-mono mt-3">⚡ {battleEnd.durationMs.toLocaleString()} ms</div>
                )}
                {battleEnd.graceTimeout && (
                  <p className="text-gray-400 text-sm mt-2">Opponent did not cast in time</p>
                )}
              </>
            )}

            {wins > 0 && (
              <div className="mt-6 text-center">
                <span className={`text-5xl font-black ${colorClass}`}>🏆 {wins}</span>
                <div className="text-gray-400 text-sm mt-1 uppercase tracking-wider">consecutive win{wins > 1 ? 's' : ''}</div>
              </div>
            )}

            <div className="mt-8 flex gap-4 justify-center">
              <button
                onClick={() => {
                  socketRef.current?.emit('player:reset', { roomId }, (res: { success: boolean; error?: string }) => {
                    if (!res.success) {
                      setError(res.error || 'Cannot join rematch');
                      setTimeout(() => setError(null), 5000);
                    }
                  });
                }}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
              >
                ⚔️ Battle Again
              </button>
              <button
                onClick={() => { socketRef.current?.emit('player:exit', { roomId }); window.location.href = '/'; }}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        {error && phase === 'ended' && (
          <div className="text-center py-8">
            <div className="text-3xl mb-4">⚠️</div>
            <p className="text-red-400 text-lg font-medium">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
