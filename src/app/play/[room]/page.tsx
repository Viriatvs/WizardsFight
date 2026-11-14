'use client';

import { useState, useCallback, useEffect, useRef, use, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import SpellInput from '@/components/SpellInput';
import ChoiceInput from '@/components/ChoiceInput';
import PhoneResult from '@/components/PhoneResult';
import PuzzleInput from '@/components/PuzzleInput';
import RpsInput from '@/components/RpsInput';
import MathInput from '@/components/MathInput';
import { PotionInput as PotionPad, type PotionLevel } from '@/components/Potion';
import { RuneInput, type RuneFlashState } from '@/components/Rune';
import { MODE_LABELS, fillWords } from '@/lib/modes';
import { roundLabel } from '@/lib/game';
import { TEAMS, MAX_TEAM_SIZE, bothTeamsPresent, otherTeam, teamSizes } from '@/lib/teams';
import type { PlayerColor, GamePhase, BattleMode, SpellReveal, GameInfo, BattleEnd, RpsThrow, RpsResult, MathQuestion, MathNext, PotionShow, PotionInput, PotionStatus, RuneFlash, RuneResult } from '@/types/game';
import PixelIcon, { WIZARD_ICON } from '@/components/PixelIcon';

/** Where to send visitors of a room that no longer exists. The start page shows a notice for it. */
const ROOM_EXPIRED_URL = '/?expired=1';

/** room:update player entry. */
interface RoomPlayer { color: PlayerColor; name: string; socketId: string; fightReady: boolean; rematchReady: boolean }

const TEAM_LABEL: Record<PlayerColor, ReactNode> = {
  blue: <><PixelIcon name="wizardBlue" /> Blue team</>,
  red: <><PixelIcon name="wizardRed" /> Red team</>,
};
/** How long the correct answer of a translate/describe round shows on the phone before the result. */
const ANSWER_SHOW_MS = 3000;
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
  /** Opened from the start page's Train alone: this private room trains as soon as the wizard has a name. */
  const trainMode = searchParams.get('train') === '1';

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
  const [potion, setPotion] = useState<PotionLevel | null>(null);
  const [rune, setRune] = useState<RuneFlashState | null>(null);
  const [submitted, setSubmitted] = useState<{ correct: boolean; durationMs: number } | null>(null);
  const [graceSeconds, setGraceSeconds] = useState<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval>>();
  /** Translate/describe: the correct option, highlighted on the question for ANSWER_SHOW_MS before the result. */
  const [choiceAnswer, setChoiceAnswer] = useState<string | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout>>();
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
        setPotion(null);
        setRune(null);
        setGraceSeconds(null);
        setBattleEnd(null);
        clearTimeout(answerTimerRef.current);
        setChoiceAnswer(null);
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
      setPotion(null);
      setRune(null);
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

    // Potion Mixing: each level shows a sequence, then brewing opens; status = every wizard's progress.
    socket.on('potion:show', (data: PotionShow) => setPotion((p) => ({ show: data, shownAt: Date.now(), deadline: null, status: p?.status ?? null })));
    socket.on('potion:input', (data: PotionInput) => setPotion((p) => (p && p.show.level === data.level ? { ...p, deadline: Date.now() + data.limitMs } : p)));
    socket.on('potion:status', (data: PotionStatus) => setPotion((p) => p && { ...p, status: data }));

    // Rune Reflex: get ready, the rune flashes, someone catches it (or nobody).
    socket.on('rune:ready', (data: { flash: number }) => setRune((r) => ({ flash: data.flash, target: null, layout: [], deadline: null, wrong: false, result: null, wins: r?.wins ?? {} })));
    socket.on('rune:flash', (data: RuneFlash) => setRune((r) => r && { ...r, flash: data.flash, target: data.target, layout: data.layout, deadline: Date.now() + data.limitMs }));
    socket.on('rune:wrong', () => setRune((r) => r && { ...r, wrong: true }));
    socket.on('rune:result', (data: RuneResult) => setRune((r) => r && { ...r, result: data, wins: data.wins }));

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
      clearTimeout(answerTimerRef.current);
      if (!data.answer) return setPhase('ended');
      // Choice rounds: keep the question up with the correct option highlighted, then the result.
      setChoiceAnswer(data.answer);
      answerTimerRef.current = setTimeout(() => {
        setChoiceAnswer(null);
        setPhase('ended');
      }, ANSWER_SHOW_MS);
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

    return () => {
      clearTimeout(answerTimerRef.current);
      socket.disconnect();
    };
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
        if (trainMode) {
          socketRef.current?.emit('player:solo', { roomId }, (r: { success: boolean; error?: string }) => {
            if (!r.success) setError(r.error || 'Could not start training');
          });
        }
      } else {
        setError(res.error || 'Failed to join');
        setPhase('ended');
      }
    });
  }, [name, roomId, preferredColor, trainMode]);

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

  // Training: quitting saves the session to the history and deletes the room.
  const stopTraining = useCallback(() => {
    setError(null);
    socketRef.current?.emit('player:solo:stop', { roomId }, (res: { success: boolean; error?: string }) => {
      if (res.success) return window.location.assign('/');
      setError(res.error || 'Could not quit training');
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
          {color && !game?.training && (
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
            <div className="text-4xl mb-4 animate-spin inline-block"><PixelIcon name="hourglass" /></div>
            <p className="text-gray-400 text-lg">Connecting to battle…</p>
          </div>
        )}

        {phase === 'name' && (
          <div className="panel-stone text-center px-6 py-10 mt-4">
            <div className="text-5xl mb-4"><PixelIcon name="wizardBlue" /></div>
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
                {trainMode ? <><PixelIcon name="wizardBlue" /> Start training</> : 'Enter Battle'}
              </button>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="panel-stone text-center px-6 py-10 mt-4">
            <div className="text-5xl mb-4 animate-bounce inline-block"><PixelIcon name={WIZARD_ICON[color ?? 'blue']} /></div>
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
                  <PixelIcon name="swords" /> Let&apos;s Fight
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

        {phase === 'spell' && reveal?.mode === 'potion' && potion && (
          <PotionPad key={potion.show.level} level={potion} mySocketId={mySocketId} onTap={(level, ingredient) => submitSpell(`${level}:${ingredient}`)} />
        )}

        {phase === 'spell' && reveal?.mode === 'rune' && rune && (
          <RuneInput state={rune} myColor={color} winsNeeded={reveal.winsNeeded} onTap={(flash, r) => submitSpell(`${flash}:${r}`)} />
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
            answer={choiceAnswer}
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
            <div className="text-3xl mb-4"><PixelIcon name="warning" /></div>
            <p className="text-red-400 text-lg font-medium">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
