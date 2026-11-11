import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Desktop gets the open split layout; phones and tablets keep the original
// login card. The breakpoint matches where the split layout stops fitting.
const DESKTOP_QUERY = '(min-width: 992px)';

const getIsDesktop = () => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_QUERY).matches
    : true
);

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isBootstrapping, login } = useAuth();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [supportTopic, setSupportTopic] = useState('');
  const isDesktop = useIsDesktop();
  const redirectQuery = new URLSearchParams(location.search).get('redirect');
  const redirectPath = redirectQuery?.startsWith('/')
    ? redirectQuery
    : location.state?.from?.pathname || '/';
  const supportMessage = supportTopic === 'access'
    ? 'New employee accounts are created only by the library administrator.'
    : supportTopic === 'reset'
      ? 'Forgot your password? Please contact the library administrator for a reset.'
      : '';
  const inputDescriptionIds = [message ? 'login-message' : '', supportMessage ? 'login-support-message' : '']
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setMessage('');
  }, [credentials.username, credentials.password]);

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      await login(credentials);
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isDesktop) {
    return (
      <div className="login-classic-shell">
        <section className="login-classic-card" aria-labelledby="employee-login-title">
          <div className="login-classic-brand-strip">
            <img src="/gcc-library.png" alt="Goa Community College Library logo" className="login-classic-card-logo" />
            <div className="login-classic-brand-text" aria-hidden="true">
              <span>GOA COMMUNITY</span>
              <span>COLLEGE</span>
            </div>
          </div>

          <div className="visually-hidden" id="employee-login-description">
            Goa Community College Library employee login.
          </div>

          <div className="login-classic-card-header">
            <h1 id="employee-login-title" className="login-classic-heading">Login</h1>
          </div>

          <form onSubmit={handleSubmit} className="login-classic-form" noValidate>
            <div className="login-classic-field">
              <label className="form-label login-classic-label" htmlFor="employee-username">Username</label>
              <input
                id="employee-username"
                type="text"
                autoComplete="username"
                className="form-control login-classic-input"
                placeholder="Enter username"
                value={credentials.username}
                onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                aria-describedby={inputDescriptionIds || undefined}
                autoFocus
                required
              />
            </div>

            <div className="login-classic-field">
              <label className="form-label login-classic-label" htmlFor="employee-password">Password</label>
              <div className="login-classic-password-input-wrap">
                <input
                  id="employee-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-control login-classic-input login-classic-password-input"
                  placeholder="Enter Password"
                  value={credentials.password}
                  onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                  aria-describedby={inputDescriptionIds || undefined}
                  required
                />
                <button
                  type="button"
                  className="login-classic-password-icon"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-controls="employee-password"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M2.2 12a11.2 11.2 0 0 1 19.6 0 11.2 11.2 0 0 1-19.6 0Zm9.8 4.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0-2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
                  </svg>
                </button>
              </div>
            </div>

            {message && (
              <div id="login-message" className="login-classic-feedback login-classic-feedback-error" role="alert">
                {message}
              </div>
            )}

            {supportMessage && (
              <div id="login-support-message" className="login-classic-feedback login-classic-feedback-note" role="status">
                {supportMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-maroon login-classic-submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-classic-actions" aria-label="Login help">
            <button
              type="button"
              className="login-classic-text-link"
              onClick={() => setSupportTopic('access')}
            >
              Create an account
            </button>
            <button
              type="button"
              className="login-classic-text-link login-classic-text-link-danger"
              onClick={() => setSupportTopic('reset')}
            >
              Forgot Pass?
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <main className="login-shell">
      <aside className="login-brand-panel" aria-label="Goa Community College Library">
        <div className="login-brand-inner">
          <img src="/gcc-library.png" alt="Goa Community College Library logo" className="login-brand-logo" />
          <p className="login-brand-kicker">Goa Community College</p>
          <p className="login-brand-title">Library</p>
          <p className="login-brand-copy">
            Attendance, student records, and the book catalog in one place.
          </p>
        </div>
        <Link to="/opac" className="login-catalog-link">
          Looking for a book? <span>Browse the catalog</span>
        </Link>
      </aside>

      <section className="login-panel" aria-labelledby="employee-login-title">
        <div className="login-panel-inner">
          <div className="visually-hidden" id="employee-login-description">
            Goa Community College Library employee login.
          </div>

          <header className="login-header">
            <p className="login-eyebrow">Library staff</p>
            <h1 id="employee-login-title" className="login-heading">Sign in</h1>
            <p className="login-subcopy">Use your library employee account to continue.</p>
          </header>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="login-field">
              <label className="form-label login-label" htmlFor="employee-username">Username</label>
              <input
                id="employee-username"
                type="text"
                autoComplete="username"
                className="form-control login-input"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                aria-describedby={inputDescriptionIds || undefined}
                autoFocus
                required
              />
            </div>

            <div className="login-field">
              <label className="form-label login-label" htmlFor="employee-password">Password</label>
              <div className="login-password-input-wrap">
                <input
                  id="employee-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-control login-input login-password-input"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                  aria-describedby={inputDescriptionIds || undefined}
                  required
                />
                <button
                  type="button"
                  className="login-password-icon"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-controls="employee-password"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M2.2 12a11.2 11.2 0 0 1 19.6 0 11.2 11.2 0 0 1-19.6 0Zm9.8 4.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0-2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
                  </svg>
                </button>
              </div>
            </div>

            {message && (
              <div id="login-message" className="login-feedback login-feedback-error" role="alert">
                {message}
              </div>
            )}

            {supportMessage && (
              <div id="login-support-message" className="login-feedback login-feedback-note" role="status">
                {supportMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-maroon login-submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="login-actions" aria-label="Login help">
            <button
              type="button"
              className="login-text-link"
              onClick={() => setSupportTopic('reset')}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="login-text-link"
              onClick={() => setSupportTopic('access')}
            >
              Need an account?
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
