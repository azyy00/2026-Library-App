import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './components/Dashboard';
import StudentRegistration from './components/StudentRegistration';
import AttendanceLog from './components/AttendanceLog';
import ActiveVisitors from './components/ActiveVisitors';
import AdminProfilePage from './pages/AdminProfilePage';
import AttendanceMonitoringPage from './pages/AttendanceMonitoringPage';
import MonitoringRegistrationPage from './pages/MonitoringRegistrationPage';
import LoginPage from './pages/LoginPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './assets/css/App.css';

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
            path="/"
            element={(
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Dashboard />} />
            <Route path="register" element={<StudentRegistration />} />
            <Route path="attendance" element={<AttendanceLog />} />
            <Route path="active" element={<ActiveVisitors />} />
            <Route path="admin-profile" element={<AdminProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

