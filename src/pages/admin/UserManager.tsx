import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { AppUser, UserRole } from '../../types';

export function UserManager() {
  const { firebaseUser } = useAuth();
  const [emailSearch, setEmailSearch] = useState('');
  const [searchResult, setSearchResult] = useState<AppUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<AppUser[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(15)));
      setRecent(snap.docs.map((d) => d.data() as AppUser));
    })();
  }, []);

  const handleSearch = async () => {
    setError(null);
    setNotice(null);
    setSearchResult(null);
    if (!emailSearch.trim()) return;
    setSearching(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', emailSearch.trim())));
      if (snap.empty) {
        setError('No user found with that email. They need to register first.');
      } else {
        setSearchResult(snap.docs[0].data() as AppUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    if (uid === firebaseUser?.uid && role !== 'admin') {
      setError("You can't remove your own admin access from here — ask another admin to do it.");
      return;
    }
    await updateDoc(doc(db, 'users', uid), { role });
    setNotice(`Role updated to ${role}.`);
    setSearchResult((prev) => (prev ? { ...prev, role } : prev));
    setRecent((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Manage users</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Promote a student to teacher (so they can create and assign custom
        tests) or admin. Search by their exact registered email.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Email address"
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            fullWidth
          />
          <Button variant="contained" onClick={handleSearch} disabled={searching}>
            Search
          </Button>
        </Stack>

        {searchResult && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle1">{searchResult.displayName}</Typography>
              <Typography variant="body2" color="text.secondary">{searchResult.email}</Typography>
            </Box>
            <Select
              value={searchResult.role}
              onChange={(e) => handleRoleChange(searchResult.uid, e.target.value as UserRole)}
              size="small"
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </Box>
        )}
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>Recently registered</Typography>
      <Paper variant="outlined">
        <List>
          {recent.map((u) => (
            <ListItem
              key={u.uid}
              secondaryAction={
                <Select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                  size="small"
                >
                  <MenuItem value="student">Student</MenuItem>
                  <MenuItem value="teacher">Teacher</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              }
            >
              <ListItemText
                primary={u.displayName}
                secondary={
                  <Stack direction="row" spacing={1}>
                    <span>{u.email}</span>
                    {u.class && <Chip size="small" label={`Class ${u.class}`} />}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
