import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: 'admin' | 'employee';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Laden...</div>;
  }

  if (!user) {
    return <Navigate to="/anmelden" replace />;
  }

  if (role === 'admin' && user.role !== 'admin') {
    return <Navigate to="/mitarbeiter" replace />;
  }

  if (role === 'employee' && user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}