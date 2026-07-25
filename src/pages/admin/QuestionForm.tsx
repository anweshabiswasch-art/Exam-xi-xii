import { useEffect, useState } from 'react';
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Topic, QuestionType, Difficulty } from '../../types';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'standard', label: 'Standard MCQ' },
  { value: 'assertion_reason', label: 'Assertion–Reason' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multiple_statement', label: 'Multiple Statements' },
  { value: 'chronological', label: 'Chronological Arrangement' },
  { value: 'rearrangement', label: 'Rearrangement of Incidents' },
  { value: 'match_following', label: 'Match the Following' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'vocabulary', label: 'Vocabulary MCQ' },
  { value: 'grammar', label: 'Grammar MCQ' },
];

export function QuestionForm({ onSaved }: { onSaved?: () => void }) {
  const { firebaseUser } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questionClass, setQuestionClass] = useState<'XI' | 'XII'>('XI');
  const [topicId, setTopicId] = useState('');
  const [type, setType] = useState<QuestionType>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [tagsInput, setTagsInput] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<0 | 1 | 2 | 3>(0);
  const [explanation, setExplanation] = useState('');
  const [referencePage, setReferencePage] = useState('');
  const [estimatedSeconds, setEstimatedSeconds] = useState(60);
  const [examYear, setExamYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'topics'), where('class', '==', questionClass));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic);
      setTopics(list);
      setTopicId(list[0]?.id ?? '');
    })();
  }, [questionClass]);

  const resetForm = () => {
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswerIndex(0);
    setExplanation('');
    setReferencePage('');
    setTagsInput('');
    setExamYear('');
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (!firebaseUser) return;
    if (!topicId) {
      setError('Create a topic first, then choose it here.');
      return;
    }
    if (!questionText.trim() || options.some((o) => !o.trim())) {
      setError('Question text and all four options are required.');
      return;
    }
    const topic = topics.find((t) => t.id === topicId);

    await addDoc(collection(db, 'questions'), {
      class: questionClass,
      topicId,
      chapter: topic?.chapter ?? '',
      type,
      difficulty,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      questionText: questionText.trim(),
      options,
      correctAnswerIndex,
      explanation: explanation.trim(),
      referencePage: referencePage.trim(),
      estimatedSeconds,
      createdAt: serverTimestamp(),
      createdBy: firebaseUser.uid,
      ...(examYear.trim() ? { examYear: Number(examYear.trim()) } : {}),
    });

    setSuccess(true);
    resetForm();
    onSaved?.();
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>Add a question</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Question saved.</Alert>}

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

        <TextField select label="Question type" value={type} onChange={(e) => setType(e.target.value as QuestionType)} fullWidth>
          {QUESTION_TYPES.map((qt) => (
            <MenuItem key={qt.value} value={qt.value}>{qt.label}</MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup exclusive value={difficulty} onChange={(_, v) => v && setDifficulty(v)}>
          <ToggleButton value="easy">Easy</ToggleButton>
          <ToggleButton value="medium">Medium</ToggleButton>
          <ToggleButton value="hard">Hard</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label="Tags (comma separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="poetry, romantics, imagery"
          fullWidth
        />

        <TextField
          label="Question text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />

        {options.map((opt, i) => (
          <TextField
            key={i}
            label={`Option ${i + 1}`}
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
            fullWidth
          />
        ))}

        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>Correct answer</Typography>
          <Stack direction="row" spacing={1}>
            {options.map((_, i) => (
              <Chip
                key={i}
                label={`Option ${i + 1}`}
                color={correctAnswerIndex === i ? 'success' : 'default'}
                onClick={() => setCorrectAnswerIndex(i as 0 | 1 | 2 | 3)}
                clickable
              />
            ))}
          </Stack>
        </Box>

        <TextField
          label="Explanation (shown after submission)"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />

        <TextField
          label="Reference page (optional)"
          value={referencePage}
          onChange={(e) => setReferencePage(e.target.value)}
          fullWidth
        />

        <TextField
          label="WBCHSE exam year (optional — leave blank unless this is from an actual past paper)"
          type="number"
          value={examYear}
          onChange={(e) => setExamYear(e.target.value)}
          sx={{ maxWidth: 320 }}
        />

        <TextField
          label="Estimated solving time (seconds)"
          type="number"
          value={estimatedSeconds}
          onChange={(e) => setEstimatedSeconds(Number(e.target.value))}
          sx={{ maxWidth: 220 }}
        />

        <Button variant="contained" size="large" onClick={handleSave}>Save question</Button>
      </Stack>
    </Paper>
  );
}
