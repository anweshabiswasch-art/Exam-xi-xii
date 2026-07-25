import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { firebaseUser, appUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ textDecoration: 'none', color: 'inherit', fontFamily: '"Source Serif 4", serif', flexGrow: 1 }}
        >
          WordCraft
        </Typography>

        {firebaseUser ? (
          <>
            <Button color="inherit" component={Link} to="/dashboard">
              Dashboard
            </Button>
            <Button color="inherit" component={Link} to="/test/setup">
              New Test
            </Button>
            <Button color="inherit" component={Link} to="/practice/setup">
              Adaptive Practice
            </Button>
            <Button color="inherit" component={Link} to="/materials">
              Materials
            </Button>
            <Button color="inherit" component={Link} to="/leaderboard">
              Leaderboard
            </Button>
            <Button color="inherit" component={Link} to="/announcements">
              Announcements
            </Button>
            {(appUser?.role === 'teacher' || appUser?.role === 'admin') && (
              <Button color="inherit" component={Link} to="/teacher">
                Teacher
              </Button>
            )}
            {appUser?.role === 'admin' && (
              <Button color="inherit" component={Link} to="/admin">
                Admin
              </Button>
            )}
            {appUser?.class && <Chip label={`Class ${appUser.class}`} size="small" sx={{ color: '#fff', borderColor: '#fff' }} variant="outlined" />}
            <Button
              color="inherit"
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button color="inherit" component={Link} to="/login">
              Sign in
            </Button>
            <Button color="secondary" variant="contained" component={Link} to="/register">
              Register
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
