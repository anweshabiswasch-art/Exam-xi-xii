import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Question, TestConfig, Difficulty } from '../types';

const MARKS_PER_QUESTION = 1; // each MCQ is worth 1 mark; adjust if your syllabus differs
const SECONDS_PER_MARK = 60; // 1 minute per mark, matching typical WBCHSE MCQ pacing

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Fetches candidate questions for the given class + topic scope, then
 * builds a randomized, non-repeating paper matching the requested marks
 * and difficulty mix.
 */
export async function generateTestPaper(config: TestConfig): Promise<Question[]> {
  const constraints = [where('class', '==', config.class)];

  const q =
    config.topicIds === 'ALL'
      ? query(collection(db, 'questions'), ...constraints)
      : query(
          collection(db, 'questions'),
          ...constraints,
          where('topicId', 'in', config.topicIds.slice(0, 30)) // Firestore 'in' cap
        );

  const snap = await getDocs(q);
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);

  const byYear = config.examYear ? all.filter((q) => q.examYear === config.examYear) : all;

  const questionCount = config.totalMarks / MARKS_PER_QUESTION;

  let pool: Question[];
  if (config.difficulty === 'mixed') {
    pool = byYear;
  } else {
    pool = byYear.filter((q) => q.difficulty === config.difficulty);
    if (pool.length < questionCount) {
      // Not enough at the exact difficulty — top up from the full pool
      // rather than fail, so the student still gets a full paper.
      const rest = byYear.filter((q) => !pool.includes(q));
      pool = [...pool, ...shuffle(rest)];
    }
  }

  if (pool.length < questionCount) {
    const scopeNote = config.examYear ? ` from the ${config.examYear} paper` : '';
    throw new Error(
      `Only ${pool.length} questions are available${scopeNote} for this selection, but ${questionCount} are needed. Ask your admin to add more questions, or choose fewer marks.`
    );
  }

  return shuffle(pool).slice(0, questionCount);
}

export function durationForMarks(totalMarks: number): number {
  return totalMarks * SECONDS_PER_MARK;
}

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
