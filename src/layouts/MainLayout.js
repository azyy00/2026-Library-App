import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

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
          <p className="mb-1">Goa Community College Library Attendance Management System</p>
          <small>Designed for attendance tracking, student lookup, and dashboard reporting.</small>
        </footer>
      </div>
    </div>
  );
}

export default MainLayout;
