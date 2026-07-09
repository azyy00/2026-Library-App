import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function CatalogStandaloneShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleAttendanceClick = () => {
    closeMenu();

    if (isAuthenticated) {
      navigate('/monitoring');
      return;
    }

    navigate('/login?redirect=%2Fmonitoring');
  };

  const handleLogout = async () => {
    closeMenu();
    setIsSigningOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  const menuClassName = `catalog-kiosk-actions${isMenuOpen ? ' is-open' : ''}`;

  return (
    <div className="monitoring-shell catalog-kiosk-shell">
      <div className="monitoring-window catalog-kiosk-window">
        <header className="monitoring-header">
          <div className="monitoring-header-strip catalog-kiosk-strip">
            <div className="catalog-navbar">
              <NavLink to="/opac" className="catalog-kiosk-brand" aria-label="Go to OPAC home">
                <img
                  src="/gcc-library.png"
                  alt="Goa Community College Library logo"
                  className="catalog-kiosk-logo"
                />
                <div className="catalog-kiosk-copy">
                  <span className="monitoring-kicker">Goa Community College Library</span>
                  <h1>Online Public Access Catalog</h1>
                </div>
              </NavLink>

              <button
                type="button"
                className="catalog-navbar-toggle"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMenuOpen}
                aria-controls="catalog-navbar-menu"
                onClick={() => setIsMenuOpen((current) => !current)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>

            <div id="catalog-navbar-menu" className={menuClassName}>
              <NavLink
                to="/opac"
                end
                className={({ isActive }) => `monitoring-toolbar-link catalog-navbar-link${isActive ? ' is-active' : ''}`}
                onClick={closeMenu}
              >
                OPAC Home
              </NavLink>
              <button
                type="button"
                className="monitoring-toolbar-button catalog-navbar-link"
                onClick={handleAttendanceClick}
              >
                Student Attendance
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  className="monitoring-toolbar-button catalog-navbar-link"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              ) : (
                <button
                  type="button"
                  className="monitoring-toolbar-button catalog-navbar-link"
                  onClick={() => {
                    closeMenu();
                    navigate('/login');
                  }}
                >
                  Admin Login
                </button>
              )}
            </div>
          </div>
        </header>

        {children}

        <footer className="catalog-kiosk-footer">
          <small>Developed by Anthony Azuela</small>
        </footer>
      </div>
    </div>
  );
}

export default CatalogStandaloneShell;
