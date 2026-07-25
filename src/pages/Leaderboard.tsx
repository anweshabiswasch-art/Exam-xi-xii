import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getWeekKey, getMonthKey } from '../utils/gamification';
import type { LeaderboardEntry } from '../types';

type Period = 'weekly' | 'monthly' | 'allTime';

const MEDAL_COLORS = ['#D4AF37', '#A8A9AD', '#B5651D']; // gold, silver, bronze

export function LeaderboardPage() {
  const { appUser, firebaseUser } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const studentClass = appUser?.class ?? 'XI';

  useEffect(() => {
    (async () => {
      setLoading(true);
      let entriesRef;
      if (period === 'weekly') {
        entriesRef = collection(db, 'leaderboardWeekly', getWeekKey(new Date()), 'entries');
      } else if (period === 'monthly') {
        entriesRef = collection(db, 'leaderboardMonthly', getMonthKey(new Date()), 'entries');
      } else {
        entriesRef = collection(db, 'leaderboardAllTime');
      }

      const q = query(entriesRef, where('class', '==', studentClass), orderBy('scoreSum', 'desc'), limit(20));
      const snap = await getDocs(q);
      setEntries(snap.docs.map((d) => d.data() as LeaderboardEntry));
      setLoading(false);
    })();
  }, [period, studentClass]);

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Leaderboard</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Class {studentClass} top scorers</Typography>

      <Tabs value={period} onChange={(_, v) => setPeriod(v)} sx={{ mb: 2 }}>
        <Tab value="weekly" label="This week" />
        <Tab value="monthly" label="This month" />
        <Tab value="allTime" label="All time" />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && (
        <Paper variant="outlined">
          <List>
            {entries.map((entry, i) => {
              const isMe = entry.studentUid === firebaseUser?.uid;
              return (
                <ListItem
                  key={entry.studentUid}
                  sx={{ bgcolor: isMe ? 'action.selected' : 'transparent' }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: i < 3 ? MEDAL_COLORS[i] : 'grey.300', color: '#1A1400' }}>
                      {i < 3 ? <EmojiEventsIcon /> : i + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${entry.displayName}${isMe ? ' (you)' : ''}`}
                    secondary={`${entry.testsCount} test${entry.testsCount === 1 ? '' : 's'}`}
                  />
                  <Chip label={`${entry.scoreSum} pts`} color={isMe ? 'secondary' : 'default'} />
                </ListItem>
              );
            })}
            {entries.length === 0 && (
              <ListItem>
                <ListItemText primary="No scores yet for this period. Be the first!" />
              </ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
}
