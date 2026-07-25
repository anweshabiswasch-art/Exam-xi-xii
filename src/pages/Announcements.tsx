import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { isPushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush } from '../utils/pushNotifications';
import type { Announcement, AnnouncementType } from '../types';

const TYPE_LABEL: Record<AnnouncementType, string> = {
  general: 'General',
  exam_alert: 'Exam alert',
  new_topic: 'New topic',
  new_material: 'New material',
};

export function AnnouncementsPage() {
  const { appUser, firebaseUser } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const studentClass = appUser?.class ?? 'XI';

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement);
      setAnnouncements(all.filter((a) => a.targetClass === 'ALL' || a.targetClass === studentClass));
      setLoading(false);
    });
    return unsub;
  }, [studentClass]);

  useEffect(() => {
    if (!isPushSupported()) return;
    getExistingSubscription().then((sub) => setPushEnabled(!!sub));
  }, []);

  const handleTogglePush = async (enabled: boolean) => {
    if (!firebaseUser) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (enabled) {
        await subscribeToPush(firebaseUser.uid, appUser?.class ?? null);
      } else {
        await unsubscribeFromPush();
      }
      setPushEnabled(enabled);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not update notification settings.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Announcements</Typography>

      {isPushSupported() && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <FormControlLabel
            control={<Switch checked={pushEnabled} disabled={pushBusy} onChange={(e) => handleTogglePush(e.target.checked)} />}
            label="Push notifications for exam alerts and new content"
          />
          {pushError && <Alert severity="warning" sx={{ mt: 1 }}>{pushError}</Alert>}
        </Paper>
      )}

      {loading ? (
        <CircularProgress />
      ) : (
        <Paper variant="outlined">
          <List>
            {announcements.map((a) => (
              <ListItem key={a.id} alignItems="flex-start">
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CampaignIcon fontSize="small" color="secondary" />
                      <Typography variant="subtitle1">{a.title}</Typography>
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>{a.message}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip size="small" label={TYPE_LABEL[a.type]} />
                        <Chip size="small" variant="outlined" label={new Date(a.createdAt).toLocaleDateString()} />
                      </Stack>
                    </>
                  }
                />
              </ListItem>
            ))}
            {announcements.length === 0 && (
              <ListItem><ListItemText primary="No announcements yet." /></ListItem>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
}
