import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { addDoc, collection, doc, getDocs, increment, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  LinearProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  Tooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { isTtsSupported, speak, stopSpeaking } from '../utils/speech';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { buildPools, pickNextQuestion, stepDifficulty, type DifficultyPools } from '../utils/adaptiveEngine';
import { updateStreakAndBadges } from '../utils/gamification';
import { difficultyColor } from '../theme';
import type { AdaptiveAttempt, Difficulty, Question } from '../types';

interface SetupState {
  class: 'XI' | 'XII';
  topicIds: string[] | 'ALL';
  questionsPlanned: number;
}

const TREND_ICON: Record<'up' | 'down' | 'flat', JSX.Element> = {
  up: <TrendingUpIcon fontSize="small" />,
  down: <TrendingDownIcon fontSize="small" />,
  flat: <TrendingFlatIcon fontSize="small" />,
};

export function AdaptiveSessionPage() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const setup = location.state as SetupState | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pools, setPools] = useState<DifficultyPools | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');
  const [current, setCurrent] = useState<Question | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [attempts, setAttempts] = useState<AdaptiveAttempt[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const usedIds = useRef<Set<string>>(new Set());

  // Stop any in-progress speech whenever the question changes (or the
  // student navigates away) — must sit above any early returns to satisfy
  // React's rules of hooks.
  useEffect(() => stopSpeaking, [current?.id]);

  useEffect(() => {
    if (!setup) {
      navigate('/practice/setup');
      return;
    }
    (async () => {
      try {
        const constraints = [where('class', '==', setup.class)];
        const q =
          setup.topicIds === 'ALL'
            ? query(collection(db, 'questions'), ...constraints)
            : query(collection(db, 'questions'), ...constraints, where('topicId', 'in', setup.topicIds.slice(0, 30)));
        const snap = await getDocs(q);
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);

        if (all.length < 5) {
          setError('Not enough questions are available for this selection yet. Ask your admin to add more, or choose a broader topic scope.');
          setLoading(false);
          return;
        }

        const built = buildPools(all);
        const first = pickNextQuestion(built, 'medium', usedIds.current);
        if (!first) {
          setError('Not enough questions are available for this selection yet.');
          setLoading(false);
          return;
        }
        usedIds.current.add(first.id);
        setPools(built);
        setCurrent(first);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start the practice session.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = () => {
    if (selectedIndex === null || !current) return;
    const wasCorrect = selectedIndex === current.correctAnswerIndex;
    setAnswered(true);
    setAttempts((prev) => [
      ...prev,
      { questionId: current.id, topicId: current.topicId, difficulty: current.difficulty, correct: wasCorrect },
    ]);
  };

  const finishSession = async (finalAttempts: AdaptiveAttempt[]) => {
    setFinished(true);
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const topicAgg = new Map<string, { attempts: number; correct: number }>();

      for (const a of finalAttempts) {
        batch.set(
          doc(db, 'questionStats', a.questionId),
          { class: setup!.class, topicId: a.topicId, attempts: increment(1), correct: increment(a.correct ? 1 : 0) },
          { merge: true }
        );
        const agg = topicAgg.get(a.topicId) ?? { attempts: 0, correct: 0 };
        agg.attempts += 1;
        if (a.correct) agg.correct += 1;
        topicAgg.set(a.topicId, agg);
      }
      for (const [topicId, agg] of topicAgg) {
        batch.set(
          doc(db, 'topicStats', topicId),
          { class: setup!.class, attempts: increment(agg.attempts), correct: increment(agg.correct) },
          { merge: true }
        );
      }
      await batch.commit();

      const correctCount = finalAttempts.filter((a) => a.correct).length;
      await addDoc(collection(db, 'adaptiveSessions'), {
        studentUid: firebaseUser.uid,
        class: setup!.class,
        topicIds: setup!.topicIds,
        questionsPlanned: setup!.questionsPlanned,
        attempts: finalAttempts,
        correctCount,
        finalDifficulty: finalAttempts.at(-1)?.difficulty ?? 'medium',
        submittedAt: serverTimestamp(),
      });

      await updateStreakAndBadges(firebaseUser.uid);
    } catch (err) {
      console.error('Could not save adaptive session', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!current || !pools || !setup) return;
    const wasCorrect = selectedIndex === current.correctAnswerIndex;
    const nextDifficulty = stepDifficulty(difficulty, wasCorrect);
    setTrend(wasCorrect ? 'up' : 'down');

    if (attempts.length >= setup.questionsPlanned) {
      finishSession(attempts);
      return;
    }

    const next = pickNextQuestion(pools, nextDifficulty, usedIds.current);
    if (!next) {
      finishSession(attempts);
      return;
    }
    usedIds.current.add(next.id);
    setDifficulty(nextDifficulty);
    setCurrent(next);
    setSelectedIndex(null);
    setAnswered(false);
  };

  if (!setup) return null;

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
        <Button sx={{ mt: 2 }} onClick={() => navigate('/practice/setup')}>Back</Button>
      </Box>
    );
  }

  if (finished) {
    const correctCount = attempts.filter((a) => a.correct).length;
    const pct = attempts.length > 0 ? Math.round((correctCount / attempts.length) * 100) : 0;
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 8, px: 2, pb: 6, textAlign: 'center' }}>
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Typography variant="overline" color="text.secondary">Session complete</Typography>
          <Typography variant="h3" sx={{ my: 1 }}>{correctCount} / {attempts.length}</Typography>
          <Chip label={`${pct}% correct`} color={pct >= 50 ? 'success' : 'error'} sx={{ mb: 2 }} />
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            You finished at <strong>{attempts.at(-1)?.difficulty ?? difficulty}</strong> difficulty.
            {saving && ' Saving your progress…'}
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" component={Link} to="/practice/setup">Practice again</Button>
            <Button variant="contained" component={Link} to="/dashboard">Back to dashboard</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!current) return null;

  const handleReadAloud = () => {
    const optionsText = current.options.map((opt, i) => `Option ${i + 1}: ${opt}`).join('. ');
    speak(`${current.questionText}. ${optionsText}`);
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 3, px: 2, pb: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Question {attempts.length + 1} of {setup.questionsPlanned}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {TREND_ICON[trend]}
          <Chip
            label={difficulty}
            size="small"
            sx={{ bgcolor: difficultyColor[difficulty], color: '#fff', textTransform: 'capitalize' }}
          />
          {isTtsSupported() && (
            <Tooltip title="Read question aloud">
              <IconButton size="small" onClick={handleReadAloud}>
                <VolumeUpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={(attempts.length / setup.questionsPlanned) * 100}
        sx={{ mb: 3, height: 6, borderRadius: 3 }}
      />

      <Paper variant="outlined" sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>{current.questionText}</Typography>

        <RadioGroup value={selectedIndex ?? ''} onChange={(e) => !answered && setSelectedIndex(Number(e.target.value))}>
          {current.options.map((option, i) => {
            const isCorrectOption = i === current.correctAnswerIndex;
            const isSelected = i === selectedIndex;
            let bg = 'transparent';
            if (answered && isCorrectOption) bg = 'success.light';
            else if (answered && isSelected && !isCorrectOption) bg = 'error.light';
            else if (!answered && isSelected) bg = 'action.selected';

            return (
              <FormControlLabel
                key={i}
                value={i}
                disabled={answered}
                control={<Radio />}
                label={option}
                sx={{
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  mx: 0,
                  mb: 1.5,
                  px: 2,
                  py: 0.5,
                  bgcolor: bg,
                }}
              />
            );
          })}
        </RadioGroup>

        {answered && (
          <Alert severity={selectedIndex === current.correctAnswerIndex ? 'success' : 'info'} sx={{ mt: 2 }}>
            {current.explanation || 'No explanation was added for this question.'}
          </Alert>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          {!answered ? (
            <Button variant="contained" disabled={selectedIndex === null} onClick={handleCheck}>
              Check answer
            </Button>
          ) : (
            <Button variant="contained" color="secondary" onClick={handleNext}>
              {attempts.length >= setup.questionsPlanned ? 'Finish session' : 'Next question'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
