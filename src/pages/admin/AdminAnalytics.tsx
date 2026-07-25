import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  getCountFromServer,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { db } from '../../firebase/config';
import type { AnalyticsSummary, Material, QuestionStat, TopicStat } from '../../types';

interface WeakestTopic {
  title: string;
  class: string;
  pct: number;
  attempts: number;
}

interface HardestQuestion {
  text: string;
  pct: number;
  attempts: number;
}

interface DashboardData {
  totalStudents: number;
  testsCount: number;
  avgScorePct: number | null;
  weakestTopic: WeakestTopic | null;
  hardestQuestion: HardestQuestion | null;
  mostDownloaded: Material | null;
}

const MIN_TOPIC_ATTEMPTS = 5; // ignore topics with too few attempts to avoid noisy conclusions
const MIN_QUESTION_ATTEMPTS = 3;

async function loadDashboard(): Promise<DashboardData> {
  const studentsSnap = await getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student')));
  const totalStudents = studentsSnap.data().count;

  const summarySnap = await getDoc(doc(db, 'analytics', 'summary'));
  const summary = (summarySnap.exists() ? summarySnap.data() : null) as AnalyticsSummary | null;
  const testsCount = summary?.testsCount ?? 0;
  const avgScorePct =
    summary && summary.totalMaxScoreSum > 0
      ? Math.round((summary.totalScoreSum / summary.totalMaxScoreSum) * 100)
      : null;

  // Weakest topic
  const topicStatsSnap = await getDocs(collection(db, 'topicStats'));
  let weakestRaw: { id: string; pct: number; attempts: number; class: string } | null = null;
  topicStatsSnap.forEach((d) => {
    const data = d.data() as TopicStat;
    if (data.attempts < MIN_TOPIC_ATTEMPTS) return;
    const pct = (data.correct / data.attempts) * 100;
    if (!weakestRaw || pct < weakestRaw.pct) {
      weakestRaw = { id: d.id, pct, attempts: data.attempts, class: data.class };
    }
  });
  let weakestTopic: WeakestTopic | null = null;
  if (weakestRaw) {
    const topicDoc = await getDoc(doc(db, 'topics', weakestRaw.id));
    const topicData = topicDoc.exists() ? topicDoc.data() : null;
    weakestTopic = {
      title: topicData ? `${topicData.chapter} — ${topicData.title}` : 'Unknown topic (deleted?)',
      class: weakestRaw.class,
      pct: Math.round(weakestRaw.pct),
      attempts: weakestRaw.attempts,
    };
  }

  // Hardest question
  const questionStatsSnap = await getDocs(collection(db, 'questionStats'));
  let hardestRaw: { id: string; pct: number; attempts: number } | null = null;
  questionStatsSnap.forEach((d) => {
    const data = d.data() as QuestionStat;
    if (data.attempts < MIN_QUESTION_ATTEMPTS) return;
    const pct = (data.correct / data.attempts) * 100;
    if (!hardestRaw || pct < hardestRaw.pct) {
      hardestRaw = { id: d.id, pct, attempts: data.attempts };
    }
  });
  let hardestQuestion: HardestQuestion | null = null;
  if (hardestRaw) {
    const qDoc = await getDoc(doc(db, 'questions', hardestRaw.id));
    const qData = qDoc.exists() ? qDoc.data() : null;
    hardestQuestion = {
      text: qData ? (qData.questionText as string) : 'Unknown question (deleted?)',
      pct: Math.round(hardestRaw.pct),
      attempts: hardestRaw.attempts,
    };
  }

  // Most downloaded material
  const materialsSnap = await getDocs(query(collection(db, 'materials'), orderBy('downloadCount', 'desc'), limit(1)));
  const mostDownloaded = materialsSnap.docs[0]
    ? ({ id: materialsSnap.docs[0].id, ...materialsSnap.docs[0].data() } as Material)
    : null;

  return { totalStudents, testsCount, avgScorePct, weakestTopic, hardestQuestion, mostDownloaded };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', height: '100%' }}>
      <Typography variant="h3">{value}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4">Analytics</Typography>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Question and topic figures only appear once at least {MIN_QUESTION_ATTEMPTS} and{' '}
        {MIN_TOPIC_ATTEMPTS} attempts have been recorded, so early numbers aren't misleading.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={4}>
              <StatCard label="Total students" value={String(data.totalStudents)} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <StatCard label="Tests taken" value={String(data.testsCount)} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <StatCard label="Average score" value={data.avgScorePct !== null ? `${data.avgScorePct}%` : '—'} />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Typography variant="overline" color="text.secondary">Weakest topic</Typography>
                {data.weakestTopic ? (
                  <>
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>{data.weakestTopic.title}</Typography>
                    <Chip
                      size="small"
                      color="error"
                      label={`${data.weakestTopic.pct}% correct`}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      Class {data.weakestTopic.class} · {data.weakestTopic.attempts} attempts
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Not enough data yet.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Typography variant="overline" color="text.secondary">Most difficult question</Typography>
                {data.hardestQuestion ? (
                  <>
                    <Typography variant="body2" sx={{ mt: 1 }}>{data.hardestQuestion.text}</Typography>
                    <Chip
                      size="small"
                      color="error"
                      label={`${data.hardestQuestion.pct}% correct`}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      {data.hardestQuestion.attempts} attempts
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Not enough data yet.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Typography variant="overline" color="text.secondary">Most downloaded material</Typography>
                {data.mostDownloaded ? (
                  <>
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>{data.mostDownloaded.title}</Typography>
                    <Chip size="small" label={`${data.mostDownloaded.downloadCount ?? 0} downloads`} sx={{ mt: 1 }} />
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No downloads yet.</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
