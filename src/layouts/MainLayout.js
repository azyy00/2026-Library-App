import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

const footerPages = [
  {
    href: 'https://web.facebook.com/GoaCommunityCollege',
    label: 'GCC Facebook Page',
    description: 'Official Goa Community College page',
    logo: '/GCC-LOGO.png',
    alt: 'Goa Community College logo'
  },
  {
    href: 'https://web.facebook.com/gcccollegelibrary',
    label: 'GCC Library Page',
    description: 'Official GCC Library page',
    logo: '/gcc-library.png',
    alt: 'Goa Community College Library logo'
  }
];

const pageMeta = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Library attendance analytics, chart summaries, and export tools.'
  },
  '/attendance': {
    title: 'Attendance Desk',
    subtitle: 'Search students, assign visit purpose, and log check-in activity.'
  },
  '/active': {
    title: 'Active Visitors',
    subtitle: 'Review all open attendance records and complete check-out.'
  },
  '/register': {
    title: 'Student Registration',
    subtitle: 'Create or update student records before attendance starts.'
  }
};

function MainLayout() {
  const location = useLocation();
  const activePage = pageMeta[location.pathname] || pageMeta['/'];
  const currentDate = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="admin-shell">
      <Navbar />

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="section-eyebrow mb-2">Goa Community College Library</p>
            <h1 className="admin-page-title">{activePage.title}</h1>
            <p className="admin-page-subtitle mb-0">{activePage.subtitle}</p>
          </div>

          <div className="admin-topbar-actions">
            <div className="topbar-chip">{currentDate}</div>
            <div className="topbar-chip">Live Workspace</div>
            <div className="topbar-avatar">GC</div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>

        <footer className="admin-footer">
          <div className="admin-footer-copy">
            <p className="mb-1">Goa Community College Library Attendance Management System</p>
            <small>Designed for attendance tracking, student lookup, and dashboard reporting.</small>
          </div>
          <div className="admin-footer-links" aria-label="Official GCC pages">
            {footerPages.map((page) => (
              <a
                key={page.href}
                className="admin-footer-link"
                href={page.href}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={page.logo}
                  alt={page.alt}
                  className="admin-footer-link-logo"
                />
                <span className="admin-footer-link-copy">
                  <strong>{page.label}</strong>
                  <small>{page.description}</small>
                </span>
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default MainLayout;
