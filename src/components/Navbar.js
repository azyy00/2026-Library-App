import React from 'react';
import { NavLink } from 'react-router-dom';

const navGroups = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', end: true, badge: 'DB' }
    ]
  },
  {
    title: 'Library Desk',
    items: [
      { to: '/attendance', label: 'Attendance Desk', badge: 'AT' },
      { to: '/active', label: 'Active Visitors', badge: 'AV' }
    ]
  },
  {
    title: 'Records',
    items: [
      { to: '/register', label: 'Student Registration', badge: 'RG' }
    ]
  }
];

function Navbar() {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="sidebar-brand-logo" />
        <div>
          <p className="sidebar-brand-label">Library Attendance</p>
          <strong>Goa Community College</strong>
        </div>
      </div>

      <div className="sidebar-campus-card">
        <div className="sidebar-campus-badge">GC</div>
        <div>
          <strong>Campus Workspace</strong>
          <span>Attendance and analytics portal</span>
        </div>
      </div>

      <div className="sidebar-nav-sections">
        {navGroups.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            <p className="sidebar-group-title">{group.title}</p>
            <div className="sidebar-links">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <span className="sidebar-link-badge">{item.badge}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer-note">
        <strong>Library Operations</strong>
        <p className="mb-0">Monitor student visits, registration status, and attendance analytics in one place.</p>
      </div>
    </aside>
  );
}

export default Navbar;
