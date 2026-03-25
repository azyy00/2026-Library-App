import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="auth-loading-logo" />
          <p className="section-eyebrow">Employee Workspace</p>
          <h2>Preparing the library dashboard...</h2>
          <p className="mb-0 text-muted">Checking your employee session before opening the attendance tools.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
