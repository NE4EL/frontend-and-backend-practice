import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function RoleRoute({ allowedRoles, children }) {
  const token = localStorage.getItem('accessToken');
  if (!token) return <Navigate to="/login" replace />;

  try {
    const payload = jwtDecode(token);
    if (!allowedRoles.includes(payload.role)) {
      return <Navigate to="/products" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return children;
}