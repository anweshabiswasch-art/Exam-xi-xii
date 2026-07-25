import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { BADGE_INFO } from '../utils/gamification';
import { findWeakestTopic } from '../utils/recommendations';
import type { AppUser, CustomTest, TestResult, Topic } from '../types';

export function StudentDashboard() {
  const { appUser, firebaseUser } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [liveUser, setLiveUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    // A live listener (rather than the one-time appUser from AuthContext)
    // so the streak/badges shown here update immediately after a test.
    return onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      if (snap.exists()) setLiveUser(snap.data() as AppUser);
    });
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      const q = query(
        collection(db, 'results'),
        where('studentUid', '==', firebaseUser.uid),
        orderBy('submittedAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TestResult));
      setLoading(false);
    })();
  }, [firebaseUser]);

  const average =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + r.score / r.maxScore, 0) / results.length) * 100
        )
      : null;

  const [assignedTests, setAssignedTests] = useState<CustomTest[]>([]);
  const [completedTestIds, setCompletedTestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!firebaseUser || !appUser?.class) return;
    (async () => {
      const [classSnap, individualSnap] = await Promise.all([
        getDocs(query(collection(db, 'customTests'), where('class', '==', appUser.class), where('assignedToAll', '==', true))),
        getDocs(query(collection(db, 'customTests'), where('class', '==', appUser.class), where('assignedToUids', 'array-contains', firebaseUser.uid))),
      ]);
      const merged = new Map<string, CustomTest>();
      for (const d of [...classSnap.docs, ...individualSnap.docs]) {
        merged.set(d.id, { id: d.id, ...d.data() } as CustomTest);
      }
      const tests = Array.from(merged.values());
      setAssignedTests(tests);

      if (tests.length > 0) {
        const completedSnap = await getDocs(
          query(collection(db, 'results'), where('studentUid', '==', firebaseUser.uid), where('customTestId', 'in', tests.map((t) => t.id).slice(0, 30)))
        );
        setCompletedTestIds(new Set(completedSnap.docs.map((d) => d.data().customTestId as string)));
      }
    })();
  }, [firebaseUser, appUser?.class]);

  const weakest = useMemo(() => findWeakestTopic(results), [results]);
  const [weakestTopic, setWeakestTopic] = useState<Topic | null>(null);

  useEffect(() => {
    if (!weakest) {
      setWeakestTopic(null);
      return;
    }
    (async () => {
      const snap = await getDoc(doc(db, 'topics', weakest.topicId));
      setWeakestTopic(snap.exists() ? ({ id: snap.id, ...snap.data() } as Topic) : null);
    })();
  }, [weakest]);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Welcome back, {appUser?.displayName?.split(' ')[0] ?? 'there'}</Typography>
          <Typography color="text.secondary">Class {appUser?.class ?? '—'}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} to="/practice/setup" variant="outlined" size="large">
            Adaptive practice
          </Button>
          <Button component={Link} to="/test/setup" variant="contained" size="large">
            Start a test
          </Button>
        </Stack>
      </Box>
      <Button component={Link} to="/leaderboard" variant="text" sx={{ mb: 3 }}>
        View leaderboard →
      </Button>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{results.length}</Typography>
            <Typography variant="body2" color="text.secondary">Tests taken</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{average !== null ? `${average}%` : '—'}</Typography>
            <Typography variant="body2" color="text.secondary">Average score</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
              {liveUser?.currentStreak ?? 0}
              {(liveUser?.currentStreak ?? 0) > 0 && <LocalFireDepartmentIcon color="secondary" />}
            </Typography>
            <Typography variant="body2" color="text.secondary">Day streak</Typography>
          </Paper>
        </Grid>
      </Grid>

      {liveUser?.badges && liveUser.badges.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Badges</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {liveUser.badges.map((badgeId) => {
              const info = BADGE_INFO[badgeId];
              if (!info) return null;
              return (
                <Tooltip key={badgeId} title={info.description}>
                  <Chip label={`${info.emoji} ${info.label}`} variant="outlined" />
                </Tooltip>
              );
            })}
          </Stack>
        </Box>
      )}

      {weakest && weakestTopic && (
        <Paper variant="outlined" sx={{ p: 3, mb: 4, borderColor: 'secondary.main', borderWidth: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AutoAwesomeIcon color="secondary" fontSize="small" />
            <Typography variant="overline" color="secondary.main">Recommended for you</Typography>
          </Stack>
          <Typography variant="subtitle1">{weakestTopic.chapter} — {weakestTopic.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You're getting {Math.round(weakest.correctRate * 100)}% right here across your last {weakest.attempts} questions on this topic — worth a focused practice round.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            component={Link}
            to="/practice/session"
            state={{ class: appUser?.class ?? 'XI', topicIds: [weakest.topicId], questionsPlanned: 10 }}
          >
            Practice this topic now
          </Button>
        </Paper>
      )}

      {assignedTests.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Assigned by your teacher</Typography>
          <Stack spacing={1.5}>
            {assignedTests.map((t) => {
              const done = completedTestIds.has(t.id);
              return (
                <Paper key={t.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">{t.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t.teacherName} · {t.questionIds.length} questions
                    </Typography>
                  </Box>
                  {done ? (
                    <Chip label="Completed" color="success" />
                  ) : (
                    <Button
                      variant="contained"
                      component={Link}
                      to="/test/exam"
                      state={{ customTestId: t.id }}
                    >
                      Take test
                    </Button>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>Recent tests</Typography>
      {loading && <LinearProgress />}
      {!loading && results.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No tests yet. Start your first practice test to see your progress here.
          </Typography>
        </Paper>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {results.map((r) => {
          const pct = Math.round((r.score / r.maxScore) * 100);
          return (
            <Paper key={r.id} variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1">
                  {r.score} / {r.maxScore} marks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(r.submittedAt).toLocaleString()}
                </Typography>
              </Box>
              <Chip label={`${pct}%`} color={pct >= 50 ? 'success' : 'error'} />
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
