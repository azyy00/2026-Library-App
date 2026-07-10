import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './components/Dashboard';
import StudentRegistration from './components/StudentRegistration';
import AttendanceLog from './components/AttendanceLog';
import ActiveVisitors from './components/ActiveVisitors';
import AdminProfilePage from './pages/AdminProfilePage';
import AttendanceMonitoringPage from './pages/AttendanceMonitoringPage';
import BookCatalogDetailPage from './pages/BookCatalogDetailPage';
import BookCatalogPage from './pages/BookCatalogPage';
import InventoryBooksPage from './pages/InventoryBooksPage';
import MonitoringRegistrationPage from './pages/MonitoringRegistrationPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './assets/css/App.css';

function CatalogHomeRedirect() {
  const location = useLocation();

  return <Navigate to={`/opac${location.search}`} replace />;
}

function CatalogDetailRedirect() {
  const { bookId } = useParams();

  return <Navigate to={`/opac/books/${bookId}`} replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/monitoring"
            element={(
              <ProtectedRoute>
                <AttendanceMonitoringPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/monitoring/register"
            element={(
              <ProtectedRoute>
                <MonitoringRegistrationPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/opac"
            element={<BookCatalogPage />}
          />
          <Route
            path="/opac/books/:bookId"
            element={<BookCatalogDetailPage />}
          />
          <Route
            path="/catalog"
            element={<CatalogHomeRedirect />}
          />
          <Route
            path="/catalog/books/:bookId"
            element={<CatalogDetailRedirect />}
          />
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Dashboard />} />
            <Route path="register" element={<StudentRegistration />} />
            <Route path="inventory-books" element={<InventoryBooksPage />} />
            <Route path="attendance" element={<AttendanceLog />} />
            <Route path="active" element={<ActiveVisitors />} />
            <Route path="admin-profile" element={<AdminProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

