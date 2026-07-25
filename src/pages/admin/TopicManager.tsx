import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../../firebase/config';
import type { Topic } from '../../types';

export function TopicManager() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicClass, setTopicClass] = useState<'XI' | 'XII'>('XI');
  const [chapter, setChapter] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'topics'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic));
    });
    return unsub;
  }, []);

  const handleAdd = async () => {
    setError(null);
    if (!chapter.trim() || !title.trim()) {
      setError('Chapter and title are required.');
      return;
    }
    await addDoc(collection(db, 'topics'), {
      class: topicClass,
      chapter: chapter.trim(),
      title: title.trim(),
      description: description.trim(),
      createdAt: serverTimestamp(),
    });
    setChapter('');
    setTitle('');
    setDescription('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this topic? Questions linked to it will remain but become unassigned.')) return;
    await deleteDoc(doc(db, 'topics', id));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Topics</Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Add a topic</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <ToggleButtonGroup
          exclusive
          value={topicClass}
          onChange={(_, v) => v && setTopicClass(v)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="XI">Class XI</ToggleButton>
          <ToggleButton value="XII">Class XII</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          label="Chapter (e.g. Unit 1)"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="Title (e.g. Poetry — Grammar &amp; Writing)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
          sx={{ mb: 2 }}
        />
        <Button variant="contained" onClick={handleAdd}>Add topic</Button>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>All topics</Typography>
      <Paper variant="outlined">
        <List>
          {topics.map((t) => (
            <ListItem
              key={t.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDelete(t.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={`[Class ${t.class}] ${t.chapter} — ${t.title}`}
                secondary={t.description}
              />
            </ListItem>
          ))}
          {topics.length === 0 && (
            <ListItem>
              <ListItemText primary="No topics yet." />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}
