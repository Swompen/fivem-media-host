import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MediaListPage from './pages/MediaListPage';
import MediaDetailPage from './pages/MediaDetailPage';
import CleanupPage from './pages/CleanupPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="media" element={<MediaListPage />} />
        <Route path="media/:id" element={<MediaDetailPage />} />
        <Route path="cleanup" element={<CleanupPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
