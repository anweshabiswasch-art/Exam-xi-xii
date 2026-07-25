import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Button,
} from '@mui/material';
import { db } from '../../firebase/config';
import type { CustomTest, TestResult } from '../../types';

export function TestResultsView() {
  const { testId } = useParams<{ testId: string }>();
  const [test, setTest] = useState<CustomTest | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    (async () => {
      try {
        const testSnap = await getDoc(doc(db, 'customTests', testId));
        if (!testSnap.exists()) {
          setError('Test not found.');
          return;
        }
        setTest({ id: testSnap.id, ...testSnap.data() } as CustomTest);

        const resultsSnap = await getDocs(query(collection(db, 'results'), where('customTestId', '==', testId)));
        const list = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TestResult);
        list.sort((a, b) => b.score / b.maxScore - a.score / a.maxScore);
        setResults(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load results.');
      } finally {
        setLoading(false);
      }
    })();
  }, [testId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !test) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 8, px: 2 }}>
        <Alert severity="error">{error ?? 'Test not found.'}</Alert>
        <Button component={Link} to="/teacher" sx={{ mt: 2 }}>Back to your tests</Button>
      </Box>
    );
  }

  const assignedCount = test.assignedToAll ? null : test.assignedToUids.length;
  const average =
    results.length > 0
      ? Math.round((results.reduce((sum, r) => sum + r.score / r.maxScore, 0) / results.length) * 100)
      : null;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>{test.title}</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip size="small" label={`Class ${test.class}`} />
        <Chip size="small" label={`${test.questionIds.length} questions`} />
        <Chip size="small" label={test.assignedToAll ? 'Whole class' : `${assignedCount} students assigned`} />
        {average !== null && <Chip size="small" color="secondary" label={`${average}% average`} />}
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Results ({results.length} submitted)
      </Typography>
      <Paper variant="outlined">
        <List>
          {results.map((r) => {
            const pct = Math.round((r.score / r.maxScore) * 100);
            return (
              <ListItem key={r.id}>
                <ListItemText
                  primary={r.studentDisplayName ?? 'Student'}
                  secondary={`${r.score} / ${r.maxScore} · ${new Date(r.submittedAt).toLocaleString()}`}
                />
                <Chip label={`${pct}%`} color={pct >= 50 ? 'success' : 'error'} />
              </ListItem>
            );
          })}
          {results.length === 0 && (
            <ListItem><ListItemText primary="No submissions yet." /></ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}
