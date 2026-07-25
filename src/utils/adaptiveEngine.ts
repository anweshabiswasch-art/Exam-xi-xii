import type { Difficulty, Question } from '../types';

export type DifficultyPools = Record<Difficulty, Question[]>;

const ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export function buildPools(questions: Question[]): DifficultyPools {
  return {
    easy: questions.filter((q) => q.difficulty === 'easy'),
    medium: questions.filter((q) => q.difficulty === 'medium'),
    hard: questions.filter((q) => q.difficulty === 'hard'),
  };
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Picks the next question at the target difficulty. If that bucket has
 * run out of unused questions, it tries the neighbouring difficulty next
 * (then the next-nearest), so a session never dead-ends just because one
 * bucket is thin — it degrades gracefully instead of stopping abruptly.
 */
export function pickNextQuestion(
  pools: DifficultyPools,
  difficulty: Difficulty,
  usedIds: Set<string>
): Question | null {
  const idx = ORDER.indexOf(difficulty);
  const searchOrder = [idx, idx - 1, idx + 1, idx - 2, idx + 2].filter((i) => i >= 0 && i < ORDER.length);
  for (const i of searchOrder) {
    const available = pools[ORDER[i]].filter((q) => !usedIds.has(q.id));
    const picked = pickRandom(available);
    if (picked) return picked;
  }
  return null;
}

/** One correct answer steps up a level; one wrong answer steps down. Caps at the ends. */
export function stepDifficulty(current: Difficulty, wasCorrect: boolean): Difficulty {
  const idx = ORDER.indexOf(current);
  return wasCorrect ? ORDER[Math.min(idx + 1, ORDER.length - 1)] : ORDER[Math.max(idx - 1, 0)];
}

export const DIFFICULTY_ORDER = ORDER;
