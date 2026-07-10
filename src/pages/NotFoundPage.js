import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="notfound-shell">
      <section className="notfound-card">
        <img
          src="/GCC-LOGO.png"
          alt="Goa Community College"
          className="notfound-logo"
        />
        <p className="section-eyebrow notfound-eyebrow">GCC Library System</p>
        <p className="notfound-code">404</p>
        <h1 className="notfound-title">This page isn&rsquo;t on the shelf</h1>
        <p className="notfound-text">
          The page you were looking for has been moved, renamed, or never existed.
          Check the address, or head back to a familiar place.
        </p>

        <div className="notfound-actions">
          <Link to="/" className="btn btn-maroon">
            Back to dashboard
          </Link>
          <button
            type="button"
            className="btn btn-outline-maroon"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>

        <nav className="notfound-links" aria-label="Helpful links">
          <Link to="/attendance">Attendance desk</Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/active">Active visitors</Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/opac">Book catalog</Link>
        </nav>
      </section>
    </main>
  );
}

export default NotFoundPage;
