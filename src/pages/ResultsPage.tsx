import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Divider,
  Button,
  LinearProgress,
  Alert,
  Stack,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useAuth } from '../contexts/AuthContext';
import { exportResultToPdf } from '../utils/exportResultPdf';
import type { Question, TestResult } from '../types';
import { AiExplainPanel } from '../components/AiExplainPanel';

export function ResultsPage() {
  const { appUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { questions?: Question[]; result?: TestResult } | null;

  if (!state?.questions || !state?.result) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 8, px: 2 }}>
        <Alert severity="info">No result to show. Start a new test to see your results here.</Alert>
        <Button component={Link} to="/test/setup" sx={{ mt: 2 }}>Start a test</Button>
      </Box>
    );
  }

  const { questions, result } = state;
  const pct = Math.round((result.score / result.maxScore) * 100);
  const answersById = new Map(result.answers.map((a) => [a.questionId, a]));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Paper variant="outlined" sx={{ p: 4, mb: 4, textAlign: 'center' }}>
        <Typography variant="overline" color="text.secondary">Your score</Typography>
        <Typography variant="h2" sx={{ my: 1 }}>{result.score} / {result.maxScore}</Typography>
        <Chip label={`${pct}%`} color={pct >= 50 ? 'success' : 'error'} sx={{ fontSize: 16, py: 2, px: 1 }} />
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
            onClick={() => exportResultToPdf(appUser?.displayName ?? 'Student', questions, result)}
          >
            Download as PDF
          </Button>
        </Stack>
        <Grid container spacing={2} sx={{ mt: 3 }}>
          <Grid item xs={4}>
            <Typography variant="h6" color="success.main">{result.correctCount}</Typography>
            <Typography variant="body2" color="text.secondary">Correct</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="h6" color="error.main">{result.incorrectCount}</Typography>
            <Typography variant="body2" color="text.secondary">Incorrect</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="h6">{result.skippedCount}</Typography>
            <Typography variant="body2" color="text.secondary">Skipped</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h6" sx={{ mb: 2 }}>Difficulty-wise performance</Typography>
      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        {(['easy', 'medium', 'hard'] as const).map((d) => {
          const stats = result.difficultyBreakdown[d];
          const p = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
          return (
            <Box key={d} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{d}</Typography>
                <Typography variant="body2" color="text.secondary">{stats.correct}/{stats.total}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={p} sx={{ height: 8, borderRadius: 4 }} />
            </Box>
          );
        })}
      </Paper>

      <Typography variant="h6" sx={{ mb: 2 }}>Answer review</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {questions.map((q, i) => {
          const answer = answersById.get(q.id);
          const isCorrect = answer?.selectedIndex === q.correctAnswerIndex;
          const isSkipped = answer?.selectedIndex === null || answer?.selectedIndex === undefined;
          return (
            <Paper key={q.id} variant="outlined" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="overline" color="text.secondary">Question {i + 1}</Typography>
                <Chip
                  size="small"
                  label={isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                  color={isSkipped ? 'default' : isCorrect ? 'success' : 'error'}
                />
              </Box>
              <Typography sx={{ mb: 2 }}>{q.questionText}</Typography>
              {q.options.map((opt, oi) => (
                <Typography
                  key={oi}
                  variant="body2"
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor:
                      oi === q.correctAnswerIndex
                        ? 'success.light'
                        : oi === answer?.selectedIndex
                        ? 'error.light'
                        : 'transparent',
                  }}
                >
                  {opt}
                </Typography>
              ))}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Explanation</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {q.explanation}
              </Typography>
              {q.referencePage && (
                <Typography variant="caption" color="text.secondary">Reference: {q.referencePage}</Typography>
              )}
              <AiExplainPanel question={q} />
            </Paper>
          );
        })}
      </Box>

      <Button variant="contained" size="large" sx={{ mt: 4 }} onClick={() => navigate('/test/setup')}>
        Practice another test
      </Button>
    </Box>
  );
}
