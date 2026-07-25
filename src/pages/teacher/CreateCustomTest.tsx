import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Switch,
  Alert,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { difficultyColor } from '../../theme';
import type { AppUser, Question, Topic } from '../../types';

export function CreateCustomTest() {
  const { firebaseUser, appUser } = useAuth();
  const navigate = useNavigate();

  const [testClass, setTestClass] = useState<'XI' | 'XII'>('XI');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [negativeMarking, setNegativeMarking] = useState(false);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicFilter, setTopicFilter] = useState<string>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [assignAll, setAssignAll] = useState(true);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentUids, setSelectedStudentUids] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [topicsSnap, questionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'topics'), where('class', '==', testClass))),
        getDocs(query(collection(db, 'questions'), where('class', '==', testClass))),
      ]);
      setTopics(topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic));
      setQuestions(questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
      setSelectedQuestionIds([]);
    })();
  }, [testClass]);

  useEffect(() => {
    if (assignAll) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'student'), where('class', '==', testClass))
      );
      setStudents(snap.docs.map((d) => d.data() as AppUser));
    })();
  }, [assignAll, testClass]);

  const filteredQuestions = questions.filter((q) => {
    if (topicFilter !== 'ALL' && q.topicId !== topicFilter) return false;
    if (difficultyFilter !== 'ALL' && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const filteredStudents = students.filter((s) =>
    studentSearch.trim() ? s.displayName.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()) : true
  );

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    setError(null);
    if (!firebaseUser || !appUser) return;
    if (!title.trim()) {
      setError('Give the test a title.');
      return;
    }
    if (selectedQuestionIds.length === 0) {
      setError('Select at least one question.');
      return;
    }
    if (!assignAll && selectedStudentUids.length === 0) {
      setError('Choose at least one student, or assign to the whole class.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'customTests'), {
        teacherUid: firebaseUser.uid,
        teacherName: appUser.displayName,
        class: testClass,
        title: title.trim(),
        instructions: instructions.trim(),
        questionIds: selectedQuestionIds,
        durationSeconds: selectedQuestionIds.length * 60,
        negativeMarking,
        assignedToAll: assignAll,
        assignedToUids: assignAll ? [] : selectedStudentUids,
        createdAt: serverTimestamp(),
      });
      navigate('/teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create test.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Create a test</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Hand-pick exactly which questions your students see — this is a fixed
        paper, not auto-generated like the student self-practice tests.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup exclusive value={testClass} onChange={(_, v) => v && setTestClass(v)}>
            <ToggleButton value="XI">Class XI</ToggleButton>
            <ToggleButton value="XII">Class XII</ToggleButton>
          </ToggleButtonGroup>
          <TextField label="Test title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <TextField
            label="Instructions for students (optional)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={negativeMarking} onChange={(e) => setNegativeMarking(e.target.checked)} />}
            label="Negative marking (−0.25 per wrong answer)"
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Questions ({selectedQuestionIds.length} selected · {selectedQuestionIds.length} min duration)
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField select label="Topic" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="ALL">All topics</MenuItem>
            {topics.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.chapter} — {t.title}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Difficulty" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="ALL">All difficulties</MenuItem>
            <MenuItem value="easy">Easy</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="hard">Hard</MenuItem>
          </TextField>
        </Stack>

        <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {filteredQuestions.map((q) => (
            <ListItem key={q.id} onClick={() => toggleQuestion(q.id)} sx={{ cursor: 'pointer' }}>
              <ListItemIcon>
                <Checkbox edge="start" checked={selectedQuestionIds.includes(q.id)} tabIndex={-1} disableRipple />
              </ListItemIcon>
              <ListItemText
                primary={q.questionText}
                secondary={<Chip size="small" label={q.difficulty} sx={{ bgcolor: difficultyColor[q.difficulty], color: '#fff', mt: 0.5 }} />}
              />
            </ListItem>
          ))}
          {filteredQuestions.length === 0 && (
            <ListItem><ListItemText primary="No questions match this filter." /></ListItem>
          )}
        </List>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Assign to</Typography>
        <FormControlLabel
          control={<Checkbox checked={assignAll} onChange={(e) => setAssignAll(e.target.checked)} />}
          label={`Everyone in Class ${testClass}`}
        />
        {!assignAll && (
          <Box sx={{ pl: 2 }}>
            <TextField
              label="Search students"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            />
            <FormGroup sx={{ maxHeight: 250, overflow: 'auto' }}>
              {filteredStudents.map((s) => (
                <FormControlLabel
                  key={s.uid}
                  control={
                    <Checkbox
                      checked={selectedStudentUids.includes(s.uid)}
                      onChange={(e) =>
                        setSelectedStudentUids((prev) =>
                          e.target.checked ? [...prev, s.uid] : prev.filter((id) => id !== s.uid)
                        )
                      }
                    />
                  }
                  label={`${s.displayName} (${s.email})`}
                />
              ))}
              {filteredStudents.length === 0 && (
                <Typography variant="body2" color="text.secondary">No students found.</Typography>
              )}
            </FormGroup>
          </Box>
        )}
      </Paper>

      <Divider sx={{ mb: 3 }} />
      <Button variant="contained" size="large" fullWidth onClick={handleCreate} disabled={saving}>
        {saving ? 'Creating…' : 'Create and assign test'}
      </Button>
    </Box>
  );
}
