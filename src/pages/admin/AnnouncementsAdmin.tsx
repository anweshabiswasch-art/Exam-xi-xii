import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Announcement, AnnouncementType } from '../../types';

const TYPE_LABEL: Record<AnnouncementType, string> = {
  general: 'General announcement',
  exam_alert: 'Exam alert',
  new_topic: 'New topic uploaded',
  new_material: 'New material uploaded',
};

export function AnnouncementsAdmin() {
  const { firebaseUser } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<AnnouncementType>('general');
  const [targetClass, setTargetClass] = useState<'XI' | 'XII' | 'ALL'>('ALL');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement));
    });
  }, []);

  const handleSend = async () => {
    setError(null);
    setNotice(null);
    if (!firebaseUser) return;
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        message: message.trim(),
        type,
        targetClass,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.uid,
      });

      // Push notification is best-effort: the announcement itself is
      // already saved and visible in-app even if push isn't configured
      // or a device's subscription has expired.
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/.netlify/functions/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ title: title.trim(), message: message.trim(), targetClass }),
        });
        const result = await res.json();
        if (res.ok) {
          setNotice(`Announcement posted. Push sent to ${result.sent} device(s).`);
        } else {
          setNotice(`Announcement posted, but push notifications didn't go out: ${result.error}`);
        }
      } catch {
        setNotice('Announcement posted. Push notifications could not be reached (announcement is still visible in-app).');
      }

      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post announcement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Announcements</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Posts appear in every student's in-app announcements feed immediately.
        Push notifications also go out to any device that has notifications enabled.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Stack spacing={2}>
          <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as AnnouncementType)}>
            {(Object.keys(TYPE_LABEL) as AnnouncementType[]).map((t) => (
              <MenuItem key={t} value={t}>{TYPE_LABEL[t]}</MenuItem>
            ))}
          </TextField>

          <ToggleButtonGroup exclusive value={targetClass} onChange={(_, v) => v && setTargetClass(v)}>
            <ToggleButton value="ALL">Both classes</ToggleButton>
            <ToggleButton value="XI">Class XI only</ToggleButton>
            <ToggleButton value="XII">Class XII only</ToggleButton>
          </ToggleButtonGroup>

          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <Button variant="contained" startIcon={<CampaignIcon />} onClick={handleSend} disabled={sending}>
            {sending ? 'Sending…' : 'Post announcement'}
          </Button>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>History</Typography>
      <Paper variant="outlined">
        <List>
          {announcements.map((a) => (
            <ListItem key={a.id} alignItems="flex-start">
              <ListItemText
                primary={a.title}
                secondary={
                  <>
                    {a.message}
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={TYPE_LABEL[a.type]} />
                      <Chip size="small" label={a.targetClass === 'ALL' ? 'Both classes' : `Class ${a.targetClass}`} />
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
    </Box>
  );
}
