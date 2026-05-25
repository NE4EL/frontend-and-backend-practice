import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';

const Login    = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Catalog  = lazy(() => import('./pages/Catalog'));
const Cart     = lazy(() => import('./pages/Cart'));
const Orders   = lazy(() => import('./pages/Orders'));
const Admin    = lazy(() => import('./pages/Admin'));

function ProtectedRoute({ children }) {
  return localStorage.getItem('accessToken') ? children : <Navigate to="/login" replace />;
}
function AdminRoute({ children }) {
  const role = localStorage.getItem('userRole');
  if (!localStorage.getItem('accessToken')) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Suspense fallback={<div className="loader"><div className="loader__spinner" />Загрузка...</div>}>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/"         element={<Catalog />} />
          <Route path="/cart"     element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/admin"    element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
