import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Link,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password".');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Password reset email sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 8, px: 2 }}>
      <Paper sx={{ p: 4 }} variant="outlined">
        <Typography variant="h4" gutterBottom>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Continue your WBCHSE English practice.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Link component="button" type="button" onClick={handleReset} sx={{ alignSelf: 'flex-end', fontSize: 14 }}>
            Forgot password?
          </Link>
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            Sign in
          </Button>
        </Box>

        <Divider sx={{ my: 3 }}>or</Divider>

        <Button variant="outlined" size="large" fullWidth onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
          New here? <Link component={RouterLink} to="/register">Create an account</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
