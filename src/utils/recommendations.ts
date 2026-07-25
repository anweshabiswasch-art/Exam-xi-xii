import type { TestResult } from '../types';

export interface WeakTopicRecommendation {
  topicId: string;
  correctRate: number;
  attempts: number;
}

// Ignore topics the student has barely touched — a 1/1 or 2/3 topic isn't
// a real weakness yet, just noise from a small sample.
const MIN_ATTEMPTS_TO_RECOMMEND = 4;

/**
 * Aggregates topicBreakdown across every test a student has taken and
 * returns their single weakest topic, if there's enough data to trust it.
 * This runs entirely client-side against the student's own results, which
 * they already have full read access to — no new backend needed.
 */
export function findWeakestTopic(results: TestResult[]): WeakTopicRecommendation | null {
  const combined = new Map<string, { correct: number; total: number }>();

  for (const result of results) {
    for (const [topicId, stats] of Object.entries(result.topicBreakdown)) {
      const agg = combined.get(topicId) ?? { correct: 0, total: 0 };
      agg.correct += stats.correct;
      agg.total += stats.total;
      combined.set(topicId, agg);
    }
  }

  let weakest: WeakTopicRecommendation | null = null;
  for (const [topicId, agg] of combined) {
    if (agg.total < MIN_ATTEMPTS_TO_RECOMMEND) continue;
    const correctRate = agg.correct / agg.total;
    if (!weakest || correctRate < weakest.correctRate) {
      weakest = { topicId, correctRate, attempts: agg.total };
    }
  }
  return weakest;
}
