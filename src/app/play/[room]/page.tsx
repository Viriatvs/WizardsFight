'use client';

import { useState, useCallback, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import SpellInput from '@/components/SpellInput';
import ChoiceInput from '@/components/ChoiceInput';
import PhoneResult from '@/components/PhoneResult';
import PuzzleInput from '@/components/PuzzleInput';
import RpsInput from '@/components/RpsInput';
import MathInput from '@/components/MathInput';
import { MODE_LABELS, fillWords } from '@/lib/modes';
import { roundLabel } from '@/lib/game';
import { TEAMS, MAX_TEAM_SIZE, bothTeamsPresent, otherTeam, teamSizes } from '@/lib/teams';
import type { PlayerColor, GamePhase, BattleMode, SpellReveal, GameInfo, BattleEnd, RpsThrow, RpsResult, MathQuestion, MathNext } from '@/types/game';

/** Where to send visitors of a room that no longer exists. The start page shows a notice for it. */
const ROOM_EXPIRED_URL = '/?expired=1';

/** room:update player entry. */
interface RoomPlayer { color: PlayerColor; name: string; socketId: string; fightReady: boolean; rematchReady: boolean }

const TEAM_LABEL: Record<PlayerColor, string> = { blue: '🔵 Blue team', red: '🔴 Red team' };
const TEAM_TEXT: Record<PlayerColor, string> = { blue: 'text-blue-400', red: 'text-red-400' };

/** Memorize: this player's correctly typed words (index → word), from spell:progress. */
interface WordProgress { words: Record<number, string>; found: number; total: number }

/** Memorize: the player's words filled into `masked`, plus the word count. */
function wordDisplay(category: string, masked: string, english: string, progress: WordProgress | null, hint: string) {
  const total = progress?.total ?? masked.split(' ').length;
  return {
    category,
    text: fillWords(masked, progress?.words),
    slots: true,
    english,
    description: `${progress?.found ?? 0} of ${total} words found. ${hint}`,
    resetInputKey: progress?.found ?? 0,
  };
}

/** What SpellInput shows for the typing modes; null for the choice modes. */
function typingDisplay(reveal: SpellReveal, memorizeHidden: boolean, progress: WordProgress | null) {
  switch (reveal.mode) {
    case 'type':
      return { category: reveal.spell.category, text: reveal.spell.latin, english: reveal.spell.english, description: reveal.spell.description };
    case 'memorize':
      if (!memorizeHidden) {
        return { category: reveal.category, text: reveal.latin, english: reveal.english, notice: 'Memorize it', inputVisible: false };
      }
      return wordDisplay(reveal.category, reveal.masked, reveal.english, progress, 'Type any words you remember.');
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
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
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
  const [wordProgress, setWordProgress] = useState<WordProgress | null>(null);
  const [rpsThrow, setRpsThrow] = useState<{ throw: number; deadline: number } | null>(null);
  const [rpsResult, setRpsResult] = useState<RpsResult | null>(null);
  const [math, setMath] = useState<{ question: MathQuestion; index: number; right: number; lastCorrect: boolean | null } | null>(null);
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

    socket.on('room:update', (data: { state: string; mode: BattleMode | null; game: GameInfo; players: RoomPlayer[] }) => {
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
        setWordProgress(null);
        setRpsThrow(null);
        setRpsResult(null);
        setMath(null);
        setGraceSeconds(null);
        setBattleEnd(null);
      }
      // Found by socket id: the team (color) can change in the waiting room.
      const me = data.players.find((p) => p.socketId === socket.id);
      if (me) {
        colorRef.current = me.color;
        setColor(me.color);
        setFightReady(me.fightReady);
        setContinueReady(me.rematchReady);
      }
      setMySocketId(socket.id ?? null);
      setPlayers(data.players);
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
      setWordProgress(null);
      setRpsThrow(null);
      setRpsResult(null);
      setMath(data.mode === 'math' ? { question: data.question, index: 0, right: 0, lastCorrect: null } : null);
      setDeadline('limitMs' in data ? Date.now() + data.limitMs : null);
      setPhase('spell');
    });

    // Memorize: the spell disappears, typing starts.
    socket.on('spell:hide', (data: { limitMs: number }) => {
      setMemorizeHidden(true);
      setDeadline(Date.now() + data.limitMs);
    });

    // Rock Paper Scissors: a new throw opens, then both hands are shown.
    socket.on('rps:throw', (data: RpsThrow) => setRpsThrow({ throw: data.throw, deadline: Date.now() + data.limitMs }));
    socket.on('rps:result', (data: RpsResult) => setRpsResult(data));

    // MathIsMagic: this player's next question after each pick.
    socket.on('math:next', (data: MathNext) => {
      setMath((m) => m && { question: data.question, index: m.index + 1, right: data.right, lastCorrect: data.lastCorrect });
    });

    // Memorize: some typed words were right; only this player sees them.
    socket.on('spell:progress', (data: WordProgress) => setWordProgress(data));

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

    // The main screen closed the room ("Exit room").
    socket.on('room:closed', () => window.location.replace(ROOM_EXPIRED_URL));

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

  // Training alone: start (only wizard alone in the room) and stop (room reopens for opponents).
  const startAlone = useCallback(() => {
    setError(null);
    socketRef.current?.emit('player:solo', { roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || 'Could not start training');
    });
  }, [roomId]);

  const stopTraining = useCallback(() => {
    setError(null);
    socketRef.current?.emit('player:solo:stop', { roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || 'Could not stop training');
    });
  }, [roomId]);

  const switchTeam = useCallback((to: PlayerColor) => {
    setError(null);
    socketRef.current?.emit('player:team', { roomId, color: to }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || 'Could not change team');
    });
  }, [roomId]);

  const exitRoom = useCallback(() => {
    socketRef.current?.emit('player:exit', { roomId });
    window.location.href = '/';
  }, [roomId]);

  const playerCount = players.length;
  const teamsReady = bothTeamsPresent(players);
  const allReady = teamsReady && players.every((p) => p.fightReady);
  const sizes = teamSizes(players);
  const teamMode = playerCount > 2;

  const colorClass = color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
  const colorBg = color === 'blue' ? 'bg-blue-500/10 border-blue-500' : color === 'red' ? 'bg-red-500/10 border-red-500' : 'bg-gray-500/10 border-gray-500';

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-6">
      {countdown !== null && (
        <Countdown seconds={countdown} label={game && mode ? `${roundLabel(game.round, game.training)} · ${MODE_LABELS[mode]}` : undefined} />
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
          <h1 className="flex flex-wrap justify-center gap-x-2 text-2xl font-black uppercase" style={{ textShadow: "3px 3px 0 #000" }}>
            <span className="text-blue-400">Wizards</span>
            <span className="text-gray-500 mx-1">vs</span>
            <span className="text-red-400">Wizards</span>
          </h1>
          {color && (
            <div className={`inline-block mt-2 px-4 py-1 rounded-full border ${colorBg}`}>
              <span className={`font-bold text-sm uppercase tracking-wider ${colorClass}`}>
                {TEAM_LABEL[color]}
              </span>
            </div>
          )}
          {mode && game && (phase === 'countdown' || phase === 'spell') && (
            <div className="mt-2 text-amber-400 text-sm font-bold uppercase tracking-widest">
              {roundLabel(game.round, game.training)} · {MODE_LABELS[mode]}
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
          <div className="panel-stone text-center px-6 py-10 mt-4">
            <div className="text-5xl mb-4">🧙</div>
            <label htmlFor="wizard-name" className="block font-pixel text-amber-300 text-xl mb-4">What is your wizard name?</label>
            <div className="max-w-xs mx-auto">
              <input
                id="wizard-name"
                type="text"
                value={name}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitName(); }}
                placeholder="Your name…"
                maxLength={24}
                autoFocus
                className="input-pixel"
              />
              <button onClick={submitName} disabled={!name.trim()} className="btn-pixel mt-8 w-full text-lg">
                Enter Battle
              </button>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="panel-stone text-center px-6 py-10 mt-4">
            <div className="text-5xl mb-4 animate-bounce inline-block">🧙</div>
            {game?.training ? (
              <p className="text-amber-300 text-lg font-bold">Training alone — starting…</p>
            ) : allReady ? (
              <p className="text-amber-300 text-lg font-bold">Every wizard is ready — battle starting…</p>
            ) : fightReady ? (
              <p className="text-gray-300 text-lg font-medium">
                {teamsReady ? 'Ready! Waiting for the other wizards to press Let\u2019s Fight…' : 'Ready! Waiting for a wizard to join the other team…'}
              </p>
            ) : (
              <div className="max-w-xs mx-auto">
                <button onClick={pressFight} disabled={!teamsReady} className="btn-pixel w-full py-4 text-xl">
                  ⚔️ Let&apos;s Fight
                </button>
                <p className="text-gray-400 text-sm mt-5">
                  {!teamsReady ? 'Waiting for a wizard on the other team…' : 'Press when you are ready to duel. After that your team is locked.'}
                </p>
                {color && playerCount > 1 && (
                  <button
                    onClick={() => switchTeam(otherTeam(color))}
                    disabled={sizes[otherTeam(color)] >= MAX_TEAM_SIZE}
                    className="btn-pixel-secondary mt-6 w-full"
                  >
                    Switch to {TEAM_LABEL[otherTeam(color)]}
                  </button>
                )}
                {/* Only on pages opened from the main screen's wizard cards (?color=), while nobody else is here. */}
                {preferredColor && playerCount === 1 && (
                  <>
                    <button onClick={startAlone} className="btn-pixel-secondary mt-8 w-full text-lg">
                      🧙 Start alone
                    </button>
                    <p className="text-gray-400 text-sm mt-4">Train 5 rounds by yourself. Nobody else can join until you stop.</p>
                  </>
                )}
                {/* Alone in the room (nobody joined yet, or the opponent left): leave and free the slot. */}
                {playerCount === 1 && (
                  <button onClick={exitRoom} className="btn-pixel-secondary mt-8 w-full">
                    Exit room
                  </button>
                )}
              </div>
            )}
            {!game?.training && playerCount > 1 && (
              <div className="grid grid-cols-2 gap-3 mt-8 text-left" aria-label="Teams">
                {TEAMS.map((t) => (
                  <div key={t}>
                    <h3 className={`font-pixel text-xs uppercase tracking-widest mb-2 ${TEAM_TEXT[t]}`}>{TEAM_LABEL[t]} ({sizes[t]}/{MAX_TEAM_SIZE})</h3>
                    <ul className="text-sm text-gray-200 space-y-1">
                      {players.filter((p) => p.color === t).map((p) => (
                        <li key={p.socketId} className="truncate">
                          {p.fightReady ? '✓ ' : ''}{p.name}{p.socketId === mySocketId ? ' (you)' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {notice && <p role="status" className="text-amber-300 text-sm mt-4">{notice}. New wizards can join with the QR code.</p>}
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

        {phase === 'spell' && reveal?.mode === 'math' && math && (
          <MathInput
            {...math}
            deadline={deadline}
            onPick={(index, option) => submitSpell(`${index}:${option}`)}
          />
        )}

        {phase === 'spell' && reveal?.mode === 'rps' && (
          <RpsInput
            myColor={color}
            training={!!game?.training}
            teamMode={teamMode}
            winsNeeded={reveal.winsNeeded}
            current={rpsThrow}
            result={rpsResult}
            onPick={submitSpell}
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

        {phase === 'spell' && reveal && typingDisplay(reveal, memorizeHidden, wordProgress) && (
          <SpellInput
            {...typingDisplay(reveal, memorizeHidden, wordProgress)!}
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
            opponentPresent={!!color && players.some((p) => p.color !== color)}
            onContinue={pressContinue}
            onExit={exitRoom}
            onStopTraining={stopTraining}
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
