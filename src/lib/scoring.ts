import type { Submission, Player, BattleResult, PlayerColor, SpellData } from '@/types/game';

export function normalizeSpell(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateSubmission(text: string, spell: SpellData): boolean {
  return normalizeSpell(text) === normalizeSpell(spell.latin);
}

export function determineWinner(
  submissions: Map<string, Submission>,
  players: Map<string, Player>,
): BattleResult {
  const results = new Map<string, { color: PlayerColor; name: string; durationMs: number; correct: boolean }>();

  for (const [socketId, sub] of submissions.entries()) {
    const player = players.get(socketId);
    if (!player) continue;
    results.set(socketId, {
      color: player.color,
      name: player.name,
      durationMs: sub.durationMs,
      correct: sub.correct,
    });
  }

  const validCorrect = Array.from(submissions.values())
    .filter((s) => s.valid && s.correct)
    .sort((a, b) => a.durationMs - b.durationMs || a.submittedAt - b.submittedAt);

  if (validCorrect.length === 0) {
    return { winnerColor: null, winnerName: null, durationMs: null, results };
  }

  const winner = validCorrect[0];
  const winnerPlayer = players.get(winner.socketId);

  return {
    winnerColor: winnerPlayer?.color ?? null,
    winnerName: winnerPlayer?.name ?? null,
    durationMs: winner.durationMs,
    results,
  };
}
