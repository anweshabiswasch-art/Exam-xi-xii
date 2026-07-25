import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function TeacherRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (appUser?.role !== 'teacher' && appUser?.role !== 'admin') {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8 }}>
        <Alert severity="error">
          This area is for teachers. Ask an admin to change your account role
          from Admin → Manage users.
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
