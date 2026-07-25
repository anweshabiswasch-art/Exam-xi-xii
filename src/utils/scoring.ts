import type { AnswerRecord, Difficulty, Question, TestResult } from '../types';

export function scoreTest(
  studentUid: string,
  testPaperId: string,
  questions: Question[],
  answers: AnswerRecord[],
  negativeMarking: boolean,
  timeTakenSeconds: number
): Omit<TestResult, 'id'> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const topicBreakdown: Record<string, { correct: number; total: number }> = {};
  const difficultyBreakdown: Record<Difficulty, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  let score = 0;

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) continue;

    topicBreakdown[question.topicId] ??= { correct: 0, total: 0 };
    topicBreakdown[question.topicId].total += 1;
    difficultyBreakdown[question.difficulty].total += 1;

    if (answer.selectedIndex === null) {
      skippedCount += 1;
      continue;
    }

    if (answer.selectedIndex === question.correctAnswerIndex) {
      correctCount += 1;
      score += 1;
      topicBreakdown[question.topicId].correct += 1;
      difficultyBreakdown[question.difficulty].correct += 1;
    } else {
      incorrectCount += 1;
      if (negativeMarking) score -= 0.25;
    }
  }

  return {
    studentUid,
    testPaperId,
    answers,
    score: Math.max(0, Math.round(score * 100) / 100),
    maxScore: questions.length,
    correctCount,
    incorrectCount,
    skippedCount,
    timeTakenSeconds,
    topicBreakdown,
    difficultyBreakdown,
    submittedAt: Date.now(),
  };
}
