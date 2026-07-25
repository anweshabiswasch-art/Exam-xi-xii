import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  CircularProgress,
} from '@mui/material';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import type { Topic } from '../types';

const COUNT_OPTIONS = [10, 15, 20, 25] as const;

export function AdaptiveSetupPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [entireSyllabus, setEntireSyllabus] = useState(true);
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentClass = appUser?.class ?? 'XI';

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'topics'), where('class', '==', studentClass));
      const snap = await getDocs(q);
      setTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic));
      setLoading(false);
    })();
  }, [studentClass]);

  const handleStart = () => {
    setError(null);
    if (!entireSyllabus && selectedTopics.length === 0) {
      setError('Choose at least one topic, or switch to entire syllabus.');
      return;
    }
    navigate('/practice/session', {
      state: {
        class: studentClass,
        topicIds: entireSyllabus ? 'ALL' : selectedTopics,
        questionsPlanned: count,
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Adaptive practice</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Starts at medium difficulty. Answer correctly and it gets harder; miss
        one and it eases back — untimed, with the correct answer and
        explanation shown right after each question.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Coverage</Typography>
        <FormControlLabel
          control={<Checkbox checked={entireSyllabus} onChange={(e) => setEntireSyllabus(e.target.checked)} />}
          label="Entire syllabus"
        />
        {!entireSyllabus && (
          <FormGroup sx={{ pl: 2 }}>
            {topics.length === 0 && (
              <Typography variant="body2" color="text.secondary">No topics uploaded yet for this class.</Typography>
            )}
            {topics.map((t) => (
              <FormControlLabel
                key={t.id}
                control={
                  <Checkbox
                    checked={selectedTopics.includes(t.id)}
                    onChange={(e) =>
                      setSelectedTopics((prev) =>
                        e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                      )
                    }
                  />
                }
                label={`${t.chapter} — ${t.title}`}
              />
            ))}
          </FormGroup>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Session length</Typography>
        <ToggleButtonGroup exclusive value={count} onChange={(_, v) => v && setCount(v)}>
          {COUNT_OPTIONS.map((c) => (
            <ToggleButton key={c} value={c}>{c} questions</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      <Button variant="contained" size="large" fullWidth onClick={handleStart}>
        Start adaptive practice
      </Button>
    </Box>
  );
}
