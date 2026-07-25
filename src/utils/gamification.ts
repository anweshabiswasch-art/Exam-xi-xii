import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser } from '../types';

/** ISO 8601 week key, e.g. "2026-W29". Stable regardless of locale. */
export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export const BADGE_INFO: Record<string, { label: string; emoji: string; description: string }> = {
  first_test: { label: 'First Test', emoji: '🎉', description: 'Completed your first practice test.' },
  streak_3: { label: '3-Day Streak', emoji: '🔥', description: 'Practiced 3 days in a row.' },
  streak_7: { label: 'Week Warrior', emoji: '🔥🔥', description: 'Practiced 7 days in a row.' },
  streak_30: { label: 'Monthly Master', emoji: '🏆', description: 'Practiced 30 days in a row.' },
  tests_50: { label: '50 Tests', emoji: '💪', description: 'Completed 50 practice tests.' },
  tests_100: { label: 'Century Club', emoji: '💯', description: 'Completed 100 practice tests.' },
};

/**
 * Updates the student's daily streak and awards any newly-earned badges.
 * Runs as a transaction because streak logic needs to read the previous
 * state before deciding whether to increment, reset, or leave it alone —
 * unlike the plain counters in questionStats/topicStats, this can't be a
 * blind increment().
 */
export async function updateStreakAndBadges(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(new Date(today.getTime() - 24 * 3600 * 1000));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as AppUser;

    let currentStreak = data.currentStreak ?? 0;
    let longestStreak = data.longestStreak ?? 0;
    const testsCompleted = (data.testsCompleted ?? 0) + 1;

    if (data.lastActiveDate !== todayKey) {
      currentStreak = data.lastActiveDate === yesterdayKey ? currentStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    const badges = new Set(data.badges ?? []);
    if (testsCompleted >= 1) badges.add('first_test');
    if (currentStreak >= 3) badges.add('streak_3');
    if (currentStreak >= 7) badges.add('streak_7');
    if (currentStreak >= 30) badges.add('streak_30');
    if (testsCompleted >= 50) badges.add('tests_50');
    if (testsCompleted >= 100) badges.add('tests_100');

    tx.update(userRef, {
      currentStreak,
      longestStreak,
      lastActiveDate: todayKey,
      testsCompleted,
      badges: Array.from(badges),
    });
  });
}
