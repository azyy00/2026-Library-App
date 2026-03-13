import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './components/Dashboard';
import StudentRegistration from './components/StudentRegistration';
import AttendanceLog from './components/AttendanceLog';
import ActiveVisitors from './components/ActiveVisitors';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './assets/css/App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="register" element={<StudentRegistration />} />
          <Route path="attendance" element={<AttendanceLog />} />
          <Route path="active" element={<ActiveVisitors />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

