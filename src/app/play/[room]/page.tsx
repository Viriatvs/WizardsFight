'use client';

import { useState, useCallback, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import SpellInput from '@/components/SpellInput';
import ChoiceInput from '@/components/ChoiceInput';
import PhoneResult from '@/components/PhoneResult';
import PuzzleInput from '@/components/PuzzleInput';
import { MODE_LABELS } from '@/lib/modes';
import { roundLabel } from '@/lib/game';
import type { PlayerColor, GamePhase, BattleMode, SpellReveal, GameInfo, BattleEnd } from '@/types/game';

/** Where to send visitors of a room that no longer exists. The start page shows a notice for it. */
const ROOM_EXPIRED_URL = '/?expired=1';

/** Memorize: this player's found words, from spell:progress. */
interface MemorizeProgress { masked: string; found: number; total: number }

/** What SpellInput shows for the typing modes; null for the choice modes. */
function typingDisplay(reveal: SpellReveal, memorizeHidden: boolean, progress: MemorizeProgress | null) {
  switch (reveal.mode) {
    case 'type':
      return { category: reveal.spell.category, text: reveal.spell.latin, english: reveal.spell.english, description: reveal.spell.description };
    case 'hangman':
      return { category: reveal.category, text: reveal.masked, slots: true, english: reveal.english };
    case 'memorize':
      if (!memorizeHidden) {
        return { category: reveal.category, text: reveal.latin, english: reveal.english, notice: 'Memorize it', inputVisible: false };
      }
      return {
        category: reveal.category,
        text: progress?.masked ?? reveal.masked,
        slots: true,
        english: reveal.english,
        description: `${progress?.found ?? 0} of ${progress?.total ?? reveal.latin.split(' ').length} words found. Type any words you remember.`,
        resetInputKey: progress?.found ?? 0,
      };
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
  const [game, setGame] = useState<GameInfo | null>(null);
  /** This player pressed Next round / Fight again and waits for the opponent. */
  const [continueReady, setContinueReady] = useState(false);
  /** e.g. "Morgana left the room", shown on the waiting screen. */
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFight, setShowFight] = useState(false);
  const [mode, setMode] = useState<BattleMode | null>(null);
  const [reveal, setReveal] = useState<SpellReveal | null>(null);
  /** Local timestamp when the round ends in a draw, when the server told us. */
  const [deadline, setDeadline] = useState<number | null>(null);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
  const [memorizeProgress, setMemorizeProgress] = useState<MemorizeProgress | null>(null);
  const [submitted, setSubmitted] = useState<{ correct: boolean; durationMs: number } | null>(null);
  const [graceSeconds, setGraceSeconds] = useState<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [battleEnd, setBattleEnd] = useState<BattleEnd | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    // Also runs on every reconnect, e.g. after a server restart wiped the room.
    socket.on('connect', () => {
      socket.emit('room:check', { roomId }, (res: { exists: boolean }) => {
        if (!res.exists) return window.location.replace(ROOM_EXPIRED_URL);
        setPhase('name');
      });
    });

    socket.on('room:update', (data: { state: string; mode: BattleMode | null; game: GameInfo; players: Array<{ color: string; fightReady: boolean; rematchReady: boolean }> }) => {
      setMode(data.mode);
      setGame(data.game);
      if (data.state === 'countdown') {
        setPhase('countdown');
        setNotice(null);
      }
      if (data.state === 'playing') setPhase('spell');
      if (data.state === 'waiting') {
        setPhase('waiting');
        setSubmitted(null);
        setReveal(null);
        setDeadline(null);
        setMemorizeHidden(false);
        setMemorizeProgress(null);
        setGraceSeconds(null);
        setBattleEnd(null);
      }
      const me = data.players.find((p) => p.color === colorRef.current);
      if (me) {
        setFightReady(me.fightReady);
        setContinueReady(me.rematchReady);
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
      setMemorizeProgress(null);
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

    // Memorize: some typed words were right; only this player sees them.
    socket.on('spell:progress', (data: MemorizeProgress) => setMemorizeProgress(data));

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

    socket.on('battle:end', (data: BattleEnd) => {
      setCountdown(null);
      setGraceSeconds(null);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      setGame(data.game);
      setBattleEnd(data);
      setPhase('ended');
    });

    socket.on('player:disconnected', (data: { name: string }) => {
      setNotice(`${data.name} left the room`);
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
    socketRef.current?.emit('room:join', { roomId, name: trimmed, color: preferredColor || undefined }, (res: { success: boolean; color?: PlayerColor; error?: string; notFound?: boolean }) => {
      if (res.notFound) return window.location.replace(ROOM_EXPIRED_URL);
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

  // Next round (game going on) or Fight again (game over). The server starts once both pressed.
  const pressContinue = useCallback(() => {
    setError(null);
    setContinueReady(true);
    socketRef.current?.emit('player:reset', { roomId }, (res: { success: boolean; error?: string }) => {
      if (res.success) return;
      setContinueReady(false);
      setError(res.error || 'Could not continue');
    });
  }, [roomId]);

  const exitRoom = useCallback(() => {
    socketRef.current?.emit('player:exit', { roomId });
    window.location.href = '/';
  }, [roomId]);

  const colorClass = color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
  const colorBg = color === 'blue' ? 'bg-blue-500/10 border-blue-500' : color === 'red' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500';

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-6">
      {countdown !== null && (
        <Countdown seconds={countdown} label={game && mode ? `${roundLabel(game.round)} · ${MODE_LABELS[mode]}` : undefined} />
      )}

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
          {mode && game && (phase === 'countdown' || phase === 'spell') && (
            <div className="mt-2 text-amber-400 text-sm font-bold uppercase tracking-widest">
              {roundLabel(game.round)} · {MODE_LABELS[mode]}
            </div>
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
            {notice && <p role="status" className="text-amber-300 text-sm mt-4">{notice}. A new opponent can join with the QR code.</p>}
            {error && <p role="alert" className="text-red-400 text-sm mt-4">{error}</p>}
          </div>
        )}

        {phase === 'spell' && reveal?.mode === 'puzzle' && (
          <PuzzleInput
            image={reveal.image}
            cols={reveal.cols}
            rows={reveal.rows}
            initialOrder={reveal.order}
            onSolved={submitSpell}
            result={submitted}
            deadline={deadline}
          />
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

        {phase === 'spell' && reveal && typingDisplay(reveal, memorizeHidden, memorizeProgress) && (
          <SpellInput
            {...typingDisplay(reveal, memorizeHidden, memorizeProgress)!}
            deadline={deadline}
            spellRevealedAt={reveal.revealedAt}
            onSubmit={submitSpell}
            submitted={submitted}
            graceSeconds={graceSeconds}
          />
        )}

        {battleEnd && phase === 'ended' && (
          <PhoneResult
            end={battleEnd}
            myColor={color}
            waiting={continueReady}
            opponentPresent={playerCount >= 2}
            onContinue={pressContinue}
            onExit={exitRoom}
            error={error}
          />
        )}

        {error && phase === 'ended' && !battleEnd && (
          <div className="text-center py-8">
            <div className="text-3xl mb-4">⚠️</div>
            <p className="text-red-400 text-lg font-medium">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
