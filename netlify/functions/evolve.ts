import type { Handler } from '@netlify/functions';
import { getAdminSdk, verifyAdmin, isScheduledInvocation } from './_lib/firebaseAdmin';

// A question needs at least this many recorded attempts before the system
// trusts its performance data enough to relabel or flag it — otherwise a
// couple of lucky/unlucky guesses could swing a label around.
const MIN_ATTEMPTS = 10;

// Difficulty is inferred from the real correct-answer rate, not vibes.
const EASY_THRESHOLD = 0.75; // >=75% correct -> easy
const MEDIUM_THRESHOLD = 0.4; // 40-75% correct -> medium; below -> hard

// If almost nobody gets it right even with a healthy sample size, the
// question itself — not the students — is probably the problem (wrong
// answer key, ambiguous wording, typo). Flag it instead of silently
// tanking students' scores forever.
const FLAG_THRESHOLD = 0.15;

interface RunResult {
  questionsScanned: number;
  questionsRecalibrated: number;
  questionsFlagged: number;
}

async function runEvolution(): Promise<RunResult> {
  const admin = getAdminSdk();
  const db = admin.firestore();

  const statsSnap = await db.collection('questionStats').get();
  let recalibrated = 0;
  let flagged = 0;

  let batch = db.batch();
  let opsInBatch = 0;
  const commits: Promise<unknown>[] = [];

  const flushIfNeeded = async () => {
    if (opsInBatch >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      opsInBatch = 0;
    }
  };

  for (const statDoc of statsSnap.docs) {
    const stat = statDoc.data() as { attempts?: number; correct?: number };
    if (!stat.attempts || stat.attempts < MIN_ATTEMPTS) continue;

    const correctRate = (stat.correct ?? 0) / stat.attempts;
    const inferredDifficulty =
      correctRate >= EASY_THRESHOLD ? 'easy' : correctRate >= MEDIUM_THRESHOLD ? 'medium' : 'hard';

    const questionRef = db.collection('questions').doc(statDoc.id);
    const questionSnap = await questionRef.get();
    if (!questionSnap.exists) continue; // question was deleted; stat is stale
    const question = questionSnap.data() as { difficulty?: string; flaggedForReview?: boolean };

    const updates: Record<string, unknown> = {};

    if (question.difficulty !== inferredDifficulty) {
      updates.difficulty = inferredDifficulty;
      updates.difficultyAutoAdjusted = true;
      updates.difficultyLastEvolvedAt = admin.firestore.FieldValue.serverTimestamp();
      recalibrated += 1;
    }

    if (correctRate < FLAG_THRESHOLD && !question.flaggedForReview) {
      updates.flaggedForReview = true;
      updates.flagReason = `Only ${Math.round(correctRate * 100)}% of ${stat.attempts} attempts were correct — possible wrong answer key or unclear wording.`;
      flagged += 1;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(questionRef, updates);
      opsInBatch += 1;
      await flushIfNeeded();
    }
  }

  commits.push(batch.commit());
  await Promise.all(commits);

  return { questionsScanned: statsSnap.size, questionsRecalibrated: recalibrated, questionsFlagged: flagged };
}

export const config = { schedule: '@daily' };

export const handler: Handler = async (event) => {
  const scheduled = isScheduledInvocation(event.headers as Record<string, string | undefined>);

  if (!scheduled) {
    // Anyone can reach this URL directly, so a manual trigger must prove
    // they're a signed-in admin. The cron path is trusted because only
    // Netlify's own scheduler can set the x-netlify-event header.
    try {
      await verifyAdmin(event.headers.authorization);
    } catch (err) {
      return { statusCode: 403, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Forbidden' }) };
    }
  }

  try {
    const result = await runEvolution();
    const admin = getAdminSdk();
    await admin
      .firestore()
      .collection('evolutionLog')
      .add({
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        trigger: scheduled ? 'scheduled' : 'manual',
        ...result,
      });

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    };
  }
};
