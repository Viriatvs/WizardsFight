'use client';

import { useState, useCallback, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import SpellInput from '@/components/SpellInput';
import ChoiceInput from '@/components/ChoiceInput';
import { MODE_LABELS } from '@/lib/modes';
import type { PlayerColor, GamePhase, BattleMode, SpellReveal } from '@/types/game';

/** What SpellInput shows for the typing modes; null for the choice modes. */
function typingDisplay(reveal: SpellReveal, memorizeHidden: boolean) {
  switch (reveal.mode) {
    case 'type':
      return { category: reveal.spell.category, text: reveal.spell.latin, english: reveal.spell.english, description: reveal.spell.description };
    case 'hangman':
      return { category: reveal.category, text: reveal.masked, slots: true, english: reveal.english };
    case 'memorize':
      return memorizeHidden
        ? { category: reveal.category, text: reveal.masked, slots: true, english: reveal.english }
        : { category: reveal.category, text: reveal.latin, english: reveal.english, notice: 'Memorize it', inputVisible: false };
    default:
      return null;
  }
}

export default function PlayPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomId } = use(params);
  const socketRef = useRef<Socket | null>(null);

  const searchParams = useSearchParams();
  const preferredColor = searchParams.get('color') as PlayerColor | null;

  const [phase, setPhase] = useState<GamePhase>('connecting');
  const [name, setNameInput] = useState('');
  const [color, setColor] = useState<PlayerColor | null>(null);
  // Socket handlers are registered once, so they read the color from a ref instead of the stale state.
  const colorRef = useRef<PlayerColor | null>(null);
  const [nameReady, setNameReady] = useState(false);
  const [fightReady, setFightReady] = useState(false);
  const [bothReady, setBothReady] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [wins, setWins] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFight, setShowFight] = useState(false);
  const [mode, setMode] = useState<BattleMode | null>(null);
  const [reveal, setReveal] = useState<SpellReveal | null>(null);
  /** Local timestamp when the round ends in a draw, when the server told us. */
  const [deadline, setDeadline] = useState<number | null>(null);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
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
    allWrong?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setPhase('name');
    });

    socket.on('room:update', (data: { state: string; mode: BattleMode | null; players: Array<{ color: string; wins: number; fightReady: boolean }> }) => {
      setMode(data.mode);
      if (data.state === 'countdown') setPhase('countdown');
      if (data.state === 'playing') setPhase('spell');
      if (data.state === 'waiting') {
        setPhase('waiting');
        setSubmitted(null);
        setReveal(null);
        setDeadline(null);
        setMemorizeHidden(false);
        setGraceSeconds(null);
        setBattleEnd(null);
      }
      const me = data.players.find((p) => p.color === colorRef.current);
      if (me) {
        setWins(me.wins);
        setFightReady(me.fightReady);
      }
      setPlayerCount(data.players.length);
      setBothReady(
        data.players.length >= 2 && data.players.every((p) => p.fightReady),
      );
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

    socket.on('spell:reveal', (data: SpellReveal) => {
      setCountdown(null);
      setReveal(data);
      setMemorizeHidden(false);
      setDeadline('limitMs' in data ? Date.now() + data.limitMs : null);
      setPhase('spell');
    });

    // Hangman: one more letter uncovered. limitMs arrives with the last letter.
    socket.on('spell:hint', (data: { masked: string; limitMs?: number }) => {
      setReveal((r) => (r?.mode === 'hangman' ? { ...r, masked: data.masked } : r));
      if (data.limitMs) setDeadline(Date.now() + data.limitMs);
    });

    // Memorize: the spell disappears, typing starts.
    socket.on('spell:hide', (data: { limitMs: number }) => {
      setMemorizeHidden(true);
      setDeadline(Date.now() + data.limitMs);
    });

    socket.on('spell:submitted', (data: { correct: boolean; durationMs: number; lockedOut?: boolean }) => {
      if (!data.correct) {
        setSubmitted({ correct: false, durationMs: data.durationMs });
        // A locked-out player keeps the "wrong" state; typing modes clear it so they can retry.
        if (!data.lockedOut) setTimeout(() => setSubmitted(null), 2000);
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
      if (data.wins && colorRef.current) setWins(data.wins[colorRef.current] ?? 0);
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

  const submitName = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    socketRef.current?.emit('room:join', { roomId, name: trimmed, color: preferredColor || undefined }, (res: { success: boolean; color?: PlayerColor; error?: string }) => {
      if (res.success && res.color) {
        colorRef.current = res.color;
        setColor(res.color);
        setPhase('waiting');
      } else {
        setError(res.error || 'Failed to join');
        setPhase('ended');
      }
    });
  }, [name, roomId, preferredColor]);

  const pressFight = useCallback(() => {
    setError(null);
    socketRef.current?.emit('player:ready', { roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || 'Could not get ready');
    });
  }, [roomId]);

  const submitSpell = useCallback((text: string) => {
    socketRef.current?.emit('spell:submit', { roomId, text });
  }, [roomId]);

  const colorClass = color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
  const colorBg = color === 'blue' ? 'bg-blue-500/10 border-blue-500' : color === 'red' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500';

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-6">
      {countdown !== null && <Countdown seconds={countdown} label={mode ? MODE_LABELS[mode] : undefined} />}

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
          {mode && (phase === 'countdown' || phase === 'spell') && (
            <div className="mt-2 text-amber-400 text-sm font-bold uppercase tracking-widest">Mode: {MODE_LABELS[mode]}</div>
          )}
        </div>

        {phase === 'connecting' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 animate-spin inline-block">⏳</div>
            <p className="text-gray-400 text-lg">Connecting to battle…</p>
          </div>
        )}

        {phase === 'name' && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🧙</div>
            <p className="text-gray-300 text-lg font-medium mb-2">What is your wizard name?</p>
            <div className="max-w-xs mx-auto">
              <input
                type="text"
                value={name}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name…"
                maxLength={24}
                autoFocus
                className="w-full px-4 py-3 text-base font-mono text-center bg-gray-900/80 border-2 border-gray-600 rounded-xl
                  focus:border-amber-500 focus:outline-none focus:shadow-[0_0_15px_rgba(245,158,11,0.3)]
                  placeholder:text-gray-500"
              />
              <button
                onClick={submitName}
                disabled={!name.trim()}
                className="mt-4 w-full py-3 text-lg font-bold uppercase tracking-wider rounded-xl
                  bg-amber-600 hover:bg-amber-500 text-white
                  disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed
                  transition-colors shadow-lg"
              >
                Enter Battle
              </button>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4 animate-bounce inline-block">🧙</div>
            {bothReady ? (
              <p className="text-amber-300 text-lg font-bold">Both wizards ready — battle starting…</p>
            ) : fightReady ? (
              <p className="text-gray-300 text-lg font-medium">Ready! Waiting for your opponent to press Let&apos;s Fight…</p>
            ) : (
              <div className="max-w-xs mx-auto">
                <button
                  onClick={pressFight}
                  disabled={playerCount < 2}
                  className="btn-fight w-full py-4 text-xl font-black uppercase tracking-wider text-white rounded-2xl
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⚔️ Let&apos;s Fight
                </button>
                <p className="text-gray-500 text-sm mt-3">
                  {playerCount < 2 ? 'Waiting for an opponent to join…' : 'Press when you are ready to duel'}
                </p>
              </div>
            )}
            {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
          </div>
        )}

        {phase === 'spell' && reveal && (reveal.mode === 'translate' || reveal.mode === 'describe') && (
          <ChoiceInput
            latin={reveal.latin}
            category={reveal.category}
            question={reveal.mode === 'translate' ? 'translation' : 'description'}
            options={reveal.options}
            onPick={submitSpell}
            result={submitted}
            deadline={deadline}
          />
        )}

        {phase === 'spell' && reveal && typingDisplay(reveal, memorizeHidden) && (
          <SpellInput
            {...typingDisplay(reveal, memorizeHidden)!}
            deadline={deadline}
            spellRevealedAt={reveal.revealedAt}
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
                <p className="text-gray-500 mt-2">{battleEnd.allWrong ? 'Both wizards chose wrong' : 'No valid spell cast'}</p>
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
