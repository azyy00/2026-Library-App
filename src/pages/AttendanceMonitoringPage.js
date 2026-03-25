import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { monitoringApi } from '../services/api';

const PURPOSE_OPTIONS = [
  'Study',
  'Research',
  'Borrow Books',
  'Computer/Internet',
  'Library Card Application'
];
const MANILA_TIME_ZONE = 'Asia/Manila';

const EMPTY_SUMMARY = {
  summary: {
    todayVisits: 0,
    activeVisitors: 0,
    checkedOutToday: 0
  },
  hourly: [],
  recent: [],
  cutoffLabel: '5:00 PM',
  serverTime: ''
};

function AttendanceMonitoringPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const inputRef = useRef(null);
  const [studentId, setStudentId] = useState('');
  const [summaryData, setSummaryData] = useState(EMPTY_SUMMARY);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [selectedPurpose, setSelectedPurpose] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [screenTime, setScreenTime] = useState(new Date());

  const loadSummary = async () => {
    try {
      setIsRefreshing(true);
      const response = await monitoringApi.getSummary();
      setSummaryData(response.data);
    } catch (error) {
      console.error('Monitoring summary error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to load data right now.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
    inputRef.current?.focus();

    const summaryInterval = setInterval(() => {
      loadSummary();
    }, 30000);
    const clockInterval = setInterval(() => {
      setScreenTime(new Date());
    }, 1000);

    return () => {
      clearInterval(summaryInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const handleLookup = async (event) => {
    event.preventDefault();

    const trimmedId = studentId.trim();

    if (!trimmedId) {
      setFeedback({
        type: 'warning',
        text: 'Enter a student ID first.'
      });
      inputRef.current?.focus();
      return;
    }

    setIsSearching(true);

    try {
      const response = await monitoringApi.lookupStudent(trimmedId);
      const attendance = response.data.activeAttendance || response.data.latestAttendance || null;
      const student = response.data.student;
      const studentName = `${student.first_name} ${student.last_name}`;

      setSelectedStudent(student);
      setSelectedAttendance(attendance);
      setFeedback({
        type: response.data.isCheckedIn ? 'info' : 'secondary',
        text: response.data.isCheckedIn
          ? `${studentName} is currently inside the library.`
          : `${studentName} is ready for check-in.`
      });
    } catch (error) {
      console.error('Monitoring student lookup error:', error);
      const isMissingStudent = error.response?.status === 404;
      setSelectedStudent(null);
      setSelectedAttendance(null);
      setFeedback({
        type: 'danger',
        text: isMissingStudent
          ? 'Student not found. Use Register Student first.'
          : error.response?.data?.error || 'Unable to load this student right now.'
      });
    } finally {
      setIsSearching(false);
      inputRef.current?.focus();
    }
  };

  const handleCheckIn = async () => {
    if (!selectedStudent) {
      return;
    }

    if (!selectedPurpose) {
      setFeedback({
        type: 'warning',
        text: 'Select a purpose before checking in.'
      });
      return;
    }

    setIsActioning(true);

    try {
      const response = await monitoringApi.checkIn(selectedStudent.student_id, selectedPurpose);
      setSelectedStudent(response.data.student);
      setSelectedAttendance(response.data.attendance);
      setSelectedPurpose('');
      setStudentId('');
      setFeedback({
        type: 'success',
        text: response.data.message
      });
      await loadSummary();
    } catch (error) {
      console.error('Monitoring check-in error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to check in right now.'
      });
    } finally {
      setIsActioning(false);
      inputRef.current?.focus();
    }
  };

  const handleCheckOut = async () => {
    if (!selectedStudent) {
      return;
    }

    setIsActioning(true);

    try {
      const response = await monitoringApi.checkOut(selectedStudent.student_id);
      setSelectedStudent(response.data.student);
      setSelectedAttendance(response.data.attendance);
      setSelectedPurpose('');
      setStudentId('');
      setFeedback({
        type: 'info',
        text: response.data.message
      });
      await loadSummary();
    } catch (error) {
      console.error('Monitoring check-out error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to check out right now.'
      });
    } finally {
      setIsActioning(false);
      inputRef.current?.focus();
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  const currentDate = useMemo(() => screenTime.toLocaleDateString([], {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }), [screenTime]);

  const currentTime = useMemo(() => screenTime.toLocaleTimeString([], {
    timeZone: MANILA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }), [screenTime]);

  const selectedStudentName = selectedStudent
    ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
    : '';
  const selectedStudentMeta = selectedStudent
    ? `ID: ${selectedStudent.student_id} | ${selectedStudent.course || 'N/A'} ${selectedStudent.year_level || 'N/A'}-${selectedStudent.section || 'N/A'}`
    : '';
  const isCheckedIn = Boolean(selectedAttendance && !selectedAttendance.check_out);

  return (
    <div className="monitoring-shell">
      <div className="monitoring-window">
        <header className="monitoring-header">
          <div className="monitoring-header-strip">
            <div className="monitoring-brand">
              <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="monitoring-brand-logo" />
              <div className="monitoring-brand-copy">
                <span className="monitoring-kicker">Goa Community College</span>
                <h1>Attendance Monitoring</h1>
              </div>
            </div>
          </div>

          <div className="monitoring-utility-row">
            <div className="monitoring-now-inline">
              <div className="monitoring-now-card">
                <span className="monitoring-now-label">Date Today</span>
                <strong className="monitoring-now-value">{currentDate}</strong>
              </div>
              <div className="monitoring-now-card">
                <span className="monitoring-now-label">Time</span>
                <strong className="monitoring-now-value">{currentTime}</strong>
              </div>
            </div>

            <div className="monitoring-toolbar">
              <button type="button" className="monitoring-toolbar-button" onClick={loadSummary} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button type="button" className="monitoring-toolbar-button" onClick={() => navigate('/monitoring/register')}>
                Register Student
              </button>
              <button type="button" className="monitoring-toolbar-button" onClick={handleLogout} disabled={isSigningOut}>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </header>

        <div className="monitoring-grid">
          <section className="monitoring-panel">
            <div className="monitoring-panel-title">Today</div>

            <div className="monitoring-stat-grid">
              <div className="monitoring-stat-card">
                <span>Checked In Today</span>
                <strong>{summaryData.summary.todayVisits}</strong>
              </div>
              <div className="monitoring-stat-card">
                <span>Inside Library</span>
                <strong>{summaryData.summary.activeVisitors}</strong>
              </div>
              <div className="monitoring-stat-card">
                <span>Checked Out Today</span>
                <strong>{summaryData.summary.checkedOutToday}</strong>
              </div>
            </div>

            <div className="monitoring-hourly-card">
              <p className="monitoring-hourly-title">Hourly Check-In Count</p>
              <p className="monitoring-hourly-copy">
                Each check-in adds 1 to the hour it was entered.
              </p>
              <div className="table-responsive">
                <table className="table table-sm monitoring-hourly-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.hourly.map((row) => (
                      <tr key={row.hour}>
                        <td>{row.label}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="monitoring-panel">
            <div className="monitoring-panel-title">Student</div>

            <form className="monitoring-scan-card" onSubmit={handleLookup}>
              <div className="monitoring-purpose-block">
                <p className="monitoring-scan-label mb-2">Purpose</p>
                <div className="monitoring-purpose-grid">
                  {PURPOSE_OPTIONS.map((purposeOption) => (
                    <button
                      key={purposeOption}
                      type="button"
                      className={`monitoring-purpose-button${selectedPurpose === purposeOption ? ' active' : ''}`}
                      onClick={() => setSelectedPurpose(purposeOption)}
                    >
                      {purposeOption}
                    </button>
                  ))}
                </div>
              </div>

              <label className="monitoring-scan-label" htmlFor="monitoring-student-id">
                Enter student ID
              </label>
              <div className="monitoring-search-row">
                <input
                  id="monitoring-student-id"
                  ref={inputRef}
                  type="text"
                  className="form-control monitoring-scan-input"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="Student ID"
                  autoComplete="off"
                />
                <button type="submit" className="btn monitoring-search-button" disabled={isSearching}>
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {feedback && (
              <div className={`alert alert-${feedback.type} monitoring-feedback`} role="alert">
                {feedback.text}
              </div>
            )}

            {selectedStudent && (
              <div className="monitoring-student-action-card">
                <div className="monitoring-student-action-copy">
                  <strong>{selectedStudentName}</strong>
                  <span>{selectedStudentMeta}</span>
                  <small>
                    {isCheckedIn
                      ? 'Currently inside the library.'
                      : selectedPurpose
                        ? `Purpose: ${selectedPurpose}`
                        : 'Choose a purpose first.'}
                  </small>
                </div>

                <button
                  type="button"
                  className={`btn ${isCheckedIn ? 'btn-maroon' : 'btn-outline-maroon'} monitoring-student-action-button`}
                  onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                  disabled={isActioning}
                >
                  {isActioning ? 'Processing...' : isCheckedIn ? 'Check out' : 'Check in'}
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

export default AttendanceMonitoringPage;
