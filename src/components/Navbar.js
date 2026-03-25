import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navGroups = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', end: true }
    ]
  },
  {
    title: 'Library Desk',
    items: [
      { to: '/attendance', label: 'Attendance Desk' },
      { to: '/monitoring', label: 'Monitoring Kiosk' },
      { to: '/active', label: 'Active Visitors' }
    ]
  },
  {
    title: 'Records',
    items: [
      { to: '/register', label: 'Student Registration' }
    ]
  },
  {
    title: 'Account',
    items: [
      { to: '/admin-profile', label: 'Admin Profile' }
    ]
  }
];

function Navbar() {
  const navigate = useNavigate();
  const { employee, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="sidebar-brand-logo" />
        <div>
          <p className="sidebar-brand-label">Library Attendance</p>
          <strong>Goa Community College</strong>
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
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-employee-card">
        <div>
          <span>Signed in as</span>
          <strong>{employee?.name || employee?.username}</strong>
          <small>{employee?.title || 'Library employee access'}</small>
          <small className="sidebar-employee-username">@{employee?.username || 'library-admin'}</small>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-outline-maroon sidebar-logout-button"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </aside>
  );
}

export default Navbar;
