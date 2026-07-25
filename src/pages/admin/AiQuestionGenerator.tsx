import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Button,
  MenuItem,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Difficulty, Topic } from '../../types';

interface DraftQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  status: 'pending' | 'added' | 'discarded';
}

interface PresetState {
  topicId?: string;
  context?: string; // a flagged question's text, when arriving from Self-evolution
}

export function AiQuestionGenerator() {
  const { firebaseUser } = useAuth();
  const location = useLocation();
  const preset = location.state as PresetState | null;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [questionClass, setQuestionClass] = useState<'XI' | 'XII'>('XI');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(5);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'topics'), where('class', '==', questionClass));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic);
      setTopics(list);
      setTopicId(preset?.topicId ?? list[0]?.id ?? '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionClass]);

  const selectedTopic = topics.find((t) => t.id === topicId);

  const handleGenerate = async () => {
    setError(null);
    if (!firebaseUser || !selectedTopic) {
      setError('Choose a topic first.');
      return;
    }
    setGenerating(true);
    setDrafts([]);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/.netlify/functions/ai-generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          class: questionClass,
          chapter: selectedTopic.chapter,
          topicTitle: selectedTopic.title,
          difficulty,
          count,
          context: preset?.context,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with ${res.status}`);
      }
      const data = await res.json();
      setDrafts((data.questions as Omit<DraftQuestion, 'status'>[]).map((q) => ({ ...q, status: 'pending' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate questions.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAdd = async (index: number) => {
    if (!firebaseUser || !selectedTopic) return;
    const draft = drafts[index];
    await addDoc(collection(db, 'questions'), {
      class: questionClass,
      topicId,
      chapter: selectedTopic.chapter,
      type: 'standard',
      difficulty,
      tags: ['ai-generated'],
      questionText: draft.questionText,
      options: draft.options,
      correctAnswerIndex: draft.correctAnswerIndex,
      explanation: draft.explanation,
      estimatedSeconds: 60,
      createdAt: serverTimestamp(),
      createdBy: firebaseUser.uid,
    });
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, status: 'added' } : d)));
  };

  const handleDiscard = (index: number) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, status: 'discarded' } : d)));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>AI question generator</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Drafts new MCQs for a topic. Nothing is added to the question bank
        until you review and approve each one individually — the AI never
        writes directly to your live question bank.
      </Typography>
      {preset?.context && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Generating a replacement for a flagged question: "{preset.context}"
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup exclusive value={questionClass} onChange={(_, v) => v && setQuestionClass(v)}>
            <ToggleButton value="XI">Class XI</ToggleButton>
            <ToggleButton value="XII">Class XII</ToggleButton>
          </ToggleButtonGroup>

          <TextField select label="Topic / chapter" value={topicId} onChange={(e) => setTopicId(e.target.value)} fullWidth>
            {topics.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.chapter} — {t.title}</MenuItem>
            ))}
          </TextField>

          <ToggleButtonGroup exclusive value={difficulty} onChange={(_, v) => v && setDifficulty(v)}>
            <ToggleButton value="easy">Easy</ToggleButton>
            <ToggleButton value="medium">Medium</ToggleButton>
            <ToggleButton value="hard">Hard</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="How many questions"
            type="number"
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
            sx={{ maxWidth: 220 }}
            helperText="Max 10 per generation"
          />

          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGenerate}
            disabled={generating || !topicId}
          >
            {generating ? 'Generating…' : 'Generate drafts'}
          </Button>
        </Stack>
      </Paper>

      {generating && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {drafts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Drafts ({drafts.filter((d) => d.status === 'pending').length} awaiting review)
          </Typography>
          <Stack spacing={2}>
            {drafts.map((draft, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 3, opacity: draft.status === 'discarded' ? 0.5 : 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Typography variant="body1" sx={{ pr: 2 }}>{draft.questionText}</Typography>
                  {draft.status !== 'pending' && (
                    <Chip
                      size="small"
                      label={draft.status}
                      color={draft.status === 'added' ? 'success' : 'default'}
                    />
                  )}
                </Stack>
                {draft.options.map((opt, oi) => (
                  <Typography
                    key={oi}
                    variant="body2"
                    sx={{
                      p: 0.75,
                      borderRadius: 1,
                      mb: 0.5,
                      bgcolor: oi === draft.correctAnswerIndex ? 'success.light' : 'transparent',
                    }}
                  >
                    {opt}
                  </Typography>
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" color="text.secondary">{draft.explanation}</Typography>

                {draft.status === 'pending' && (
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button size="small" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => handleAdd(i)}>
                      Add to bank
                    </Button>
                    <Button size="small" color="inherit" startIcon={<DeleteIcon />} onClick={() => handleDiscard(i)}>
                      Discard
                    </Button>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
