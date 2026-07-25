import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { Box, Typography, Paper, Button, List, ListItem, ListItemText, Chip, Stack, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { CustomTest } from '../../types';

export function TeacherDashboard() {
  const { firebaseUser } = useAuth();
  const [tests, setTests] = useState<CustomTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'customTests'), where('teacherUid', '==', firebaseUser.uid), orderBy('createdAt', 'desc'))
      );
      setTests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomTest));
      setLoading(false);
    })();
  }, [firebaseUser]);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Your tests</Typography>
        <Button component={Link} to="/teacher/create" variant="contained" startIcon={<AddIcon />}>
          Create test
        </Button>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : (
        <Paper variant="outlined">
          <List>
            {tests.map((t) => (
              <ListItem key={t.id} component={Link} to={`/teacher/results/${t.id}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemText
                  primary={t.title}
                  secondary={
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={`Class ${t.class}`} />
                      <Chip size="small" label={`${t.questionIds.length} questions`} />
                      <Chip size="small" label={t.assignedToAll ? 'Whole class' : `${t.assignedToUids.length} students`} />
                    </Stack>
                  }
                />
              </ListItem>
            ))}
            {tests.length === 0 && (
              <ListItem><ListItemText primary="No tests yet. Create your first one." /></ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
}
