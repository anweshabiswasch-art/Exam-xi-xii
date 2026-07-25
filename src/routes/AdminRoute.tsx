import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function AdminRoute({ children }: { children: ReactNode }) {
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

  if (appUser?.role !== 'admin') {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8 }}>
        <Alert severity="error">
          This area is for administrators only. If you believe this is a mistake,
          ask an existing admin to promote your account in Firestore
          (users/&#123;uid&#125; → role: "admin").
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
