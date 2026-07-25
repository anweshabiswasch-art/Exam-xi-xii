import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  Chip,
} from '@mui/material';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { QuestionCard } from '../components/QuestionCard';
import { Timer } from '../components/Timer';
import { generateTestPaper, durationForMarks } from '../utils/testGenerator';
import { scoreTest } from '../utils/scoring';
import { getWeekKey, getMonthKey, updateStreakAndBadges } from '../utils/gamification';
import type { AnswerRecord, CustomTest, Question, TestConfig } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface LocationState {
  config?: TestConfig;
  customTestId?: string;
}

export function ExamModePage() {
  const { firebaseUser, appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { config, customTestId } = (location.state as LocationState | null) ?? {};

  const [questions, setQuestions] = useState<Question[]>([]);
  const [customTest, setCustomTest] = useState<CustomTest | null>(null);
  const [answers, setAnswers] = useState<Map<string, AnswerRecord>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  // Effective settings, regardless of which mode this session is in.
  const durationSeconds = customTest ? customTest.durationSeconds : config ? durationForMarks(config.totalMarks) : 0;
  const negativeMarking = customTest ? customTest.negativeMarking : (config?.negativeMarking ?? false);
  const sessionClass = customTest ? customTest.class : config?.class;

  useEffect(() => {
    if (!config && !customTestId) {
      navigate('/test/setup');
      return;
    }
    (async () => {
      try {
        if (customTestId) {
          const snap = await getDoc(doc(db, 'customTests', customTestId));
          if (!snap.exists()) {
            setError('This test is no longer available.');
            setLoading(false);
            return;
          }
          const test = { id: snap.id, ...snap.data() } as CustomTest;
          const questionDocs = await Promise.all(test.questionIds.map((qid) => getDoc(doc(db, 'questions', qid))));
          const loadedQuestions = questionDocs
            .filter((d) => d.exists())
            .map((d) => ({ id: d.id, ...d.data() }) as Question);
          const ordered = shuffle(loadedQuestions);
          setCustomTest(test);
          setQuestions(ordered);
          setAnswers(
            new Map(
              ordered.map((q) => [q.id, { questionId: q.id, selectedIndex: null, flagged: false, timeSpentSeconds: 0 }])
            )
          );
        } else if (config) {
          const paper = await generateTestPaper(config);
          setQuestions(paper);
          setAnswers(
            new Map(
              paper.map((q) => [q.id, { questionId: q.id, selectedIndex: null, flagged: false, timeSpentSeconds: 0 }])
            )
          );
        }
        startTimeRef.current = Date.now();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this test.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if ((!config && !customTest) || !firebaseUser || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const timeTakenSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    let testPaperId = customTest?.id ?? 'custom';
    if (config) {
      const paperDoc = await addDoc(collection(db, 'testPapers'), {
        config,
        questionIds: questions.map((q) => q.id),
        createdAt: serverTimestamp(),
        durationSeconds,
      });
      testPaperId = paperDoc.id;
    }

    const result = scoreTest(
      firebaseUser.uid,
      testPaperId,
      questions,
      Array.from(answers.values()),
      negativeMarking,
      timeTakenSeconds
    );

    const resultDoc = await addDoc(collection(db, 'results'), {
      ...result,
      submittedAt: serverTimestamp(),
      studentDisplayName: appUser?.displayName ?? 'Student',
      ...(customTest ? { customTestId: customTest.id } : {}),
    });

    // Aggregate stats for the admin analytics dashboard: per-question and
    // per-topic attempt/correct counters, plus a single running summary
    // doc for average score. This avoids the dashboard ever having to
    // scan every result at read time, so it stays fast at scale.
    const batch = writeBatch(db);
    const topicAgg = new Map<string, { attempts: number; correct: number; class: 'XI' | 'XII' }>();

    for (const q of questions) {
      const answer = answers.get(q.id);
      if (!answer || answer.selectedIndex === null) continue; // only attempted questions count
      const wasCorrect = answer.selectedIndex === q.correctAnswerIndex;

      batch.set(
        doc(db, 'questionStats', q.id),
        {
          class: q.class,
          topicId: q.topicId,
          attempts: increment(1),
          correct: increment(wasCorrect ? 1 : 0),
        },
        { merge: true }
      );

      const agg = topicAgg.get(q.topicId) ?? { attempts: 0, correct: 0, class: q.class };
      agg.attempts += 1;
      if (wasCorrect) agg.correct += 1;
      topicAgg.set(q.topicId, agg);
    }

    for (const [topicId, agg] of topicAgg) {
      batch.set(
        doc(db, 'topicStats', topicId),
        { class: agg.class, attempts: increment(agg.attempts), correct: increment(agg.correct) },
        { merge: true }
      );
    }

    batch.set(
      doc(db, 'analytics', 'summary'),
      {
        testsCount: increment(1),
        totalScoreSum: increment(result.score),
        totalMaxScoreSum: increment(result.maxScore),
      },
      { merge: true }
    );

    // Leaderboard entries — weekly, monthly, and all-time — keyed by the
    // student's own uid so security rules can guarantee nobody can inflate
    // someone else's score.
    const displayName = appUser?.displayName ?? 'Student';
    const weekKey = getWeekKey(new Date());
    const monthKey = getMonthKey(new Date());
    const leaderboardPayload = {
      studentUid: firebaseUser.uid,
      displayName,
      class: sessionClass,
      scoreSum: increment(result.score),
      testsCount: increment(1),
    };
    batch.set(doc(db, 'leaderboardWeekly', weekKey, 'entries', firebaseUser.uid), leaderboardPayload, { merge: true });
    batch.set(doc(db, 'leaderboardMonthly', monthKey, 'entries', firebaseUser.uid), leaderboardPayload, { merge: true });
    batch.set(doc(db, 'leaderboardAllTime', firebaseUser.uid), leaderboardPayload, { merge: true });

    await batch.commit();

    // Streak + badges need read-then-write logic, so they run as a
    // separate transaction. Non-fatal if it fails — the test result is
    // already saved either way.
    try {
      await updateStreakAndBadges(firebaseUser.uid);
    } catch (err) {
      console.error('Streak/badge update failed', err);
    }

    navigate('/test/results', { state: { resultId: resultDoc.id, questions, result } });
  }, [answers, appUser, config, customTest, durationSeconds, firebaseUser, navigate, negativeMarking, questions, sessionClass]);

  if (!config && !customTestId) return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 8, px: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </Box>
    );
  }

  const current = questions[currentIndex];
  const currentAnswer = answers.get(current.id)!;

  const updateAnswer = (patch: Partial<AnswerRecord>) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(current.id, { ...next.get(current.id)!, ...patch });
      return next;
    });
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 3, px: 2, pb: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{customTest ? customTest.title : 'Exam mode'}</Typography>
        <Timer totalSeconds={durationSeconds} onExpire={handleSubmit} />
      </Stack>
      {customTest?.instructions && (
        <Alert severity="info" sx={{ mb: 2 }}>{customTest.instructions}</Alert>
      )}

      <QuestionCard
        question={current}
        index={currentIndex}
        total={questions.length}
        selectedIndex={currentAnswer.selectedIndex}
        flagged={currentAnswer.flagged}
        onSelect={(idx) => updateAnswer({ selectedIndex: idx })}
        onToggleFlag={() => updateAnswer({ flagged: !currentAnswer.flagged })}
      />

      <Grid container spacing={1} sx={{ my: 3 }}>
        {questions.map((q, i) => {
          const a = answers.get(q.id)!;
          return (
            <Grid item key={q.id}>
              <Chip
                label={i + 1}
                onClick={() => setCurrentIndex(i)}
                color={a.flagged ? 'secondary' : a.selectedIndex !== null ? 'primary' : 'default'}
                variant={i === currentIndex ? 'filled' : 'outlined'}
              />
            </Grid>
          );
        })}
      </Grid>

      <Stack direction="row" justifyContent="space-between">
        <Button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button variant="contained" onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
            Next
          </Button>
        ) : (
          <Button variant="contained" color="secondary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit test'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
