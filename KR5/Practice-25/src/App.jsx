import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Loader from './components/Loader';

// Lazy-loaded routes — each becomes a separate chunk in the bundle
const Home    = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const About   = lazy(() => import('./pages/About'));

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/about"   element={<About />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
