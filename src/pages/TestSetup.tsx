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
  Alert,
  CircularProgress,
  FormGroup,
  Switch,
  Select,
  MenuItem,
} from '@mui/material';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import type { Topic, TestConfig, Difficulty } from '../types';

const MARK_OPTIONS = [20, 30, 40, 50, 100] as const;

export function TestSetupPage() {
  const { appUser, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [entireSyllabus, setEntireSyllabus] = useState(true);
  const [marks, setMarks] = useState<(typeof MARK_OPTIONS)[number]>(20);
  const [difficulty, setDifficulty] = useState<Difficulty | 'mixed'>('mixed');
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pastPaperMode, setPastPaperMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentClass = appUser?.class ?? 'XI';

  useEffect(() => {
    (async () => {
      const [topicsSnap, yearsSnap] = await Promise.all([
        getDocs(query(collection(db, 'topics'), where('class', '==', studentClass))),
        getDocs(query(collection(db, 'questions'), where('class', '==', studentClass), where('examYear', '>', 0))),
      ]);
      setTopics(topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic));

      const years = Array.from(new Set(yearsSnap.docs.map((d) => d.data().examYear as number))).sort((a, b) => b - a);
      setAvailableYears(years);
      setSelectedYear(years[0] ?? null);

      setLoading(false);
    })();
  }, [studentClass]);

  const handleStart = () => {
    if (!firebaseUser) return;
    if (!entireSyllabus && selectedTopics.length === 0) {
      setError('Choose at least one topic, or switch to entire syllabus.');
      return;
    }
    if (pastPaperMode && !selectedYear) {
      setError('Choose a year for the previous-year paper.');
      return;
    }
    const config: TestConfig = {
      studentUid: firebaseUser.uid,
      class: studentClass,
      topicIds: entireSyllabus ? 'ALL' : selectedTopics,
      totalMarks: marks,
      difficulty,
      negativeMarking,
      ...(pastPaperMode && selectedYear ? { examYear: selectedYear } : {}),
    };
    navigate('/test/exam', { state: { config } });
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
      <Typography variant="h4" gutterBottom>Set up your test</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Class {studentClass}</Typography>

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
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Marks</Typography>
        <ToggleButtonGroup exclusive value={marks} onChange={(_, v) => v && setMarks(v)}>
          {MARK_OPTIONS.map((m) => (
            <ToggleButton key={m} value={m}>{m}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Difficulty</Typography>
        <ToggleButtonGroup exclusive value={difficulty} onChange={(_, v) => v && setDifficulty(v)}>
          <ToggleButton value="easy">Easy</ToggleButton>
          <ToggleButton value="medium">Medium</ToggleButton>
          <ToggleButton value="hard">Hard</ToggleButton>
          <ToggleButton value="mixed">Mixed</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <FormControlLabel
          control={<Switch checked={negativeMarking} onChange={(e) => setNegativeMarking(e.target.checked)} />}
          label="Negative marking (−0.25 per wrong answer)"
        />
      </Paper>

      {availableYears.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <FormControlLabel
            control={<Switch checked={pastPaperMode} onChange={(e) => setPastPaperMode(e.target.checked)} />}
            label="Previous-year paper only"
          />
          {pastPaperMode && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Only draws from questions actually tagged from this WBCHSE
                paper. Your topic and difficulty choices above still apply on
                top of that — set difficulty to "Mixed" for the full
                original spread.
              </Typography>
              <Select
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                size="small"
              >
                {availableYears.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </Box>
          )}
        </Paper>
      )}

      <Button variant="contained" size="large" fullWidth onClick={handleStart}>
        Generate paper &amp; start
      </Button>
    </Box>
  );
}
