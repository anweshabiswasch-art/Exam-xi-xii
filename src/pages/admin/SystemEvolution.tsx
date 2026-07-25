import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, where, updateDoc, doc, deleteField } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FlagIcon from '@mui/icons-material/Flag';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { EvolutionLogEntry, Question } from '../../types';

export function SystemEvolution() {
  const { firebaseUser } = useAuth();
  const [log, setLog] = useState<EvolutionLogEntry[]>([]);
  const [flagged, setFlagged] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const logSnap = await getDocs(query(collection(db, 'evolutionLog'), orderBy('runAt', 'desc'), limit(10)));
      setLog(logSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvolutionLogEntry));

      const flaggedSnap = await getDocs(query(collection(db, 'questions'), where('flaggedForReview', '==', true)));
      setFlagged(flaggedSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load evolution data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRunNow = async () => {
    if (!firebaseUser) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/.netlify/functions/evolve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with ${res.status}`);
      }
      const result = await res.json();
      setMessage(
        `Scanned ${result.questionsScanned} questions — recalibrated ${result.questionsRecalibrated}, flagged ${result.questionsFlagged}.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run evolution job.');
    } finally {
      setRunning(false);
    }
  };

  const handleDismissFlag = async (questionId: string) => {
    await updateDoc(doc(db, 'questions', questionId), {
      flaggedForReview: deleteField(),
      flagReason: deleteField(),
    });
    setFlagged((prev) => prev.filter((q) => q.id !== questionId));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Self-evolution</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Every night, the system compares each question's stated difficulty
        against how students actually perform on it, and relabels it if
        reality disagrees. Questions almost nobody gets right — even with a
        healthy sample size — are flagged here in case the answer key or
        wording is wrong, rather than quietly punishing students forever.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      <Button
        variant="contained"
        startIcon={<AutoAwesomeIcon />}
        onClick={handleRunNow}
        disabled={running}
        sx={{ mb: 4 }}
      >
        {running ? 'Running…' : 'Run now'}
      </Button>

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Flagged questions ({flagged.length})
          </Typography>
          <Paper variant="outlined" sx={{ mb: 4 }}>
            <List>
              {flagged.map((q) => (
                <ListItem
                  key={q.id}
                  alignItems="flex-start"
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        component={Link}
                        to="/admin/ai-generate"
                        state={{ topicId: q.topicId, context: q.questionText }}
                      >
                        Generate replacement
                      </Button>
                      <Button size="small" onClick={() => handleDismissFlag(q.id)}>
                        Dismiss
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FlagIcon color="error" fontSize="small" />
                        <Typography variant="body1">{q.questionText}</Typography>
                      </Stack>
                    }
                    secondary={q.flagReason}
                  />
                </ListItem>
              ))}
              {flagged.length === 0 && (
                <ListItem>
                  <ListItemText primary="No flagged questions right now." />
                </ListItem>
              )}
            </List>
          </Paper>

          <Typography variant="h6" sx={{ mb: 1 }}>Recent runs</Typography>
          <Paper variant="outlined">
            <List>
              {log.map((entry) => (
                <Box key={entry.id}>
                  <ListItem>
                    <ListItemText
                      primary={new Date(entry.runAt).toLocaleString()}
                      secondary={`Scanned ${entry.questionsScanned} · recalibrated ${entry.questionsRecalibrated} · flagged ${entry.questionsFlagged}`}
                    />
                    <Chip size="small" label={entry.trigger} variant="outlined" />
                  </ListItem>
                  <Divider component="li" />
                </Box>
              ))}
              {log.length === 0 && (
                <ListItem>
                  <ListItemText primary="No runs yet. The scheduled job runs daily, or click 'Run now' above." />
                </ListItem>
              )}
            </List>
          </Paper>
        </>
      )}
    </Box>
  );
}
