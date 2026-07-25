import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../../firebase/config';
import { QuestionForm } from './QuestionForm';
import type { Question } from '../../types';
import { difficultyColor } from '../../theme';

export function QuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
    });
    return unsub;
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question permanently?')) return;
    await deleteDoc(doc(db, 'questions', id));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Question bank</Typography>

      <Box sx={{ mb: 4 }}>
        <QuestionForm />
      </Box>

      <Typography variant="h6" sx={{ mb: 1 }}>All questions ({questions.length})</Typography>
      <Paper variant="outlined">
        <List>
          {questions.map((q) => (
            <ListItem
              key={q.id}
              alignItems="flex-start"
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDelete(q.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={q.questionText}
                secondary={
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`Class ${q.class}`} />
                    <Chip size="small" label={q.type.replace('_', ' ')} />
                    <Chip
                      size="small"
                      label={q.difficulty}
                      sx={{ bgcolor: difficultyColor[q.difficulty], color: '#fff' }}
                    />
                    {q.examYear && <Chip size="small" color="secondary" label={`WBCHSE ${q.examYear}`} />}
                  </Stack>
                }
              />
            </ListItem>
          ))}
          {questions.length === 0 && (
            <ListItem>
              <ListItemText primary="No questions yet. Add your first one above." />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}
