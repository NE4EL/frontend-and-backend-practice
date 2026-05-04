import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import ProductsPage from './pages/ProductsPage/ProductsPage';
import UsersPage from './pages/UsersPage/UsersPage';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/products" element={
          <ProtectedRoute>
            <ProductsPage />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['admin']}>
              <UsersPage />
            </RoleRoute>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/products" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;