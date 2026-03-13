import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attendanceApi, buildAssetUrl, studentApi } from '../services/api';

const PURPOSE_OPTIONS = [
  {
    value: 'Study',
    shortLabel: 'Quiet Study',
    description: 'Individual reading, review, and seat usage.'
  },
  {
    value: 'Research',
    shortLabel: 'Research',
    description: 'Academic research, references, and thesis work.'
  },
  {
    value: 'Borrow Books',
    shortLabel: 'Borrowing',
    description: 'Book release, return, and shelf assistance.'
  },
  {
    value: 'Used Computer',
    shortLabel: 'Computer Use',
    description: 'Computer access for school-related tasks.'
  },
  {
    value: 'Library Card Application',
    shortLabel: 'Library Card',
    description: 'New card requests and account concerns.'
  }
];

function AttendanceLog() {
  const [studentId, setStudentId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [student, setStudent] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingVisitors, setIsRefreshingVisitors] = useState(false);
  const [screenTime, setScreenTime] = useState(new Date());
  const [showStudentImage, setShowStudentImage] = useState(false);

  useEffect(() => {
    fetchActiveVisitors(true);

    const clock = setInterval(() => {
      setScreenTime(new Date());
    }, 60000);

    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    setShowStudentImage(Boolean(student?.profile_image));
  }, [student]);

  const fetchActiveVisitors = async (initialLoad = false) => {
    if (!initialLoad) {
      setIsRefreshingVisitors(true);
    }

    try {
      const response = await attendanceApi.getActive();
      setActiveVisitors(response.data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('Error fetching active visitors:', error);
      setFeedback({
        type: 'danger',
        text: 'Unable to load the active visitor list right now.'
      });
    } finally {
      setIsRefreshingVisitors(false);
    }
  };

  const resetAttendanceForm = (preserveFeedback = false) => {
    setStudentId('');
    setStudent(null);
    setPurpose('');
    setSearchAttempted(false);
    setShowStudentImage(false);
    if (!preserveFeedback) {
      setFeedback(null);
    }
  };

  const handleSearch = async () => {
    const query = studentId.trim();

    if (!query) {
      setFeedback({ type: 'warning', text: 'Enter a student ID or name before searching.' });
      setStudent(null);
      return;
    }

    setIsSearching(true);
    setSearchAttempted(true);
    setFeedback(null);

    try {
      const response = await studentApi.search(query);
      const exactMatch = response.data.find((item) => item.student_id === query);
      const matchedStudent = exactMatch || response.data[0] || null;

      if (!matchedStudent) {
        setStudent(null);
        setFeedback({
          type: 'warning',
          text: 'No student matched that search. You can register the student if needed.'
        });
        return;
      }

      setStudent(matchedStudent);
      setFeedback({
        type: 'info',
        text: `Student record loaded for ${matchedStudent.first_name} ${matchedStudent.last_name}.`
      });
    } catch (error) {
      console.error('Search error:', error);
      setStudent(null);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Error searching for student.'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCheckIn = async () => {
    if (!student || !purpose) {
      setFeedback({
        type: 'warning',
        text: 'Select a student and a library purpose before submitting attendance.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await attendanceApi.checkIn({
        student_id: student.student_id,
        purpose
      });

      setFeedback({
        type: 'success',
        text: `${response.data.student_name} checked in successfully at ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}.`
      });
      resetAttendanceForm(true);
      fetchActiveVisitors();
    } catch (error) {
      console.error('Check-in error:', error);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Error during check-in.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPurpose = PURPOSE_OPTIONS.find((item) => item.value === purpose);
  const heroDate = screenTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="container mt-4">
      <section className="attendance-hero">
        <div className="attendance-hero-copy">
          <p className="section-eyebrow">Goa Community College</p>
          <h1 className="attendance-hero-title">Library Attendance and Visitor Monitoring</h1>
          <p className="attendance-hero-text">
            Manage student check-ins quickly, verify records before entry, and keep the active visitor list visible at the desk.
          </p>
          <div className="attendance-hero-meta">
            <span>{heroDate}</span>
            <span>{screenTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="attendance-hero-brand">
          <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="attendance-hero-logo" />
          <div>
            <strong>GCC Library Services</strong>
            <p className="mb-0">Attendance desk for student visits and activity tracking.</p>
          </div>
        </div>
      </section>

      <div className="row g-4">
        <div className="col-xl-8">
          <div className="attendance-panel">
            <div className="attendance-summary-grid">
              <div className="attendance-summary-card">
                <span className="summary-label">Active now</span>
                <strong>{activeVisitors.length}</strong>
                <small>Students currently inside the library.</small>
              </div>
              <div className="attendance-summary-card">
                <span className="summary-label">Selected purpose</span>
                <strong>{selectedPurpose ? selectedPurpose.shortLabel : 'Not selected'}</strong>
                <small>{selectedPurpose ? selectedPurpose.description : 'Choose the activity before check-in.'}</small>
              </div>
              <div className="attendance-summary-card">
                <span className="summary-label">Current status</span>
                <strong>{student ? 'Ready to check in' : 'Waiting for search'}</strong>
                <small>{student ? `${student.first_name} ${student.last_name} is loaded.` : 'Search by student ID or full name.'}</small>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-lg-7">
                <div className="attendance-block">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <p className="section-eyebrow">Step 1</p>
                      <h4 className="mb-1">Find the student record</h4>
                      <p className="text-muted mb-0">Search by student number for the fastest match.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={resetAttendanceForm}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="input-group input-group-lg mb-4">
                    <input
                      type="text"
                      className="form-control"
                      value={studentId}
                      onChange={(event) => setStudentId(event.target.value)}
                      placeholder="Enter student ID or full name"
                      onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                    />
                    <button
                      type="button"
                      className="btn btn-maroon"
                      onClick={handleSearch}
                      disabled={isSearching}
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="section-eyebrow">Step 2</p>
                    <h5 className="mb-3">Select purpose of visit</h5>
                    <div className="purpose-grid">
                      {PURPOSE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`purpose-option ${purpose === option.value ? 'purpose-option-active' : ''}`}
                          onClick={() => setPurpose(option.value)}
                        >
                          <strong>{option.shortLabel}</strong>
                          <span>{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {feedback && (
                    <div className={`alert alert-${feedback.type} attendance-alert`} role="alert">
                      {feedback.text}
                    </div>
                  )}

                  {student ? (
                    <div className="student-preview-card">
                      <div className="student-preview-header">
                        <div className="student-preview-avatar">
                          {student.profile_image && showStudentImage ? (
                            <img
                              src={buildAssetUrl(student.profile_image)}
                              alt={`${student.first_name} ${student.last_name}`}
                              onError={() => setShowStudentImage(false)}
                            />
                          ) : (
                            <span>{student.first_name?.[0] || 'S'}{student.last_name?.[0] || 'T'}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="mb-1">{student.first_name} {student.last_name}</h4>
                          <p className="text-muted mb-0">{student.student_id}</p>
                        </div>
                      </div>

                      <div className="student-preview-details">
                        <div>
                          <span>Course</span>
                          <strong>{student.course}</strong>
                        </div>
                        <div>
                          <span>Year and section</span>
                          <strong>{student.year_level}-{student.section}</strong>
                        </div>
                        <div>
                          <span>Email</span>
                          <strong>{student.email || 'No email on file'}</strong>
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2 mt-4">
                        <button
                          type="button"
                          className="btn btn-maroon btn-lg"
                          onClick={handleCheckIn}
                          disabled={isSubmitting || !purpose}
                        >
                          {isSubmitting ? 'Processing...' : 'Confirm check-in'}
                        </button>
                        <Link to="/" className="btn btn-outline-secondary btn-lg">
                          View analytics
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="attendance-empty-state">
                      <h5 className="mb-2">No student selected yet</h5>
                      <p className="text-muted mb-3">
                        Search the student record first, then pick the purpose to complete attendance.
                      </p>
                      {searchAttempted && (
                        <Link to="/register" className="btn btn-outline-maroon">
                          Register new student
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="col-lg-5">
                <div className="attendance-block h-100">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <p className="section-eyebrow">Live Desk View</p>
                      <h4 className="mb-1">Current visitors</h4>
                      <p className="text-muted mb-0">
                        {lastUpdated ? `Last updated at ${lastUpdated}` : 'Loading current visitors'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => fetchActiveVisitors()}
                      disabled={isRefreshingVisitors}
                    >
                      {isRefreshingVisitors ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {activeVisitors.length === 0 ? (
                    <div className="attendance-empty-state compact">
                      <h6 className="mb-2">Library floor is clear</h6>
                      <p className="mb-0 text-muted">No active student visit is currently open.</p>
                    </div>
                  ) : (
                    <div className="visitor-feed">
                      {activeVisitors.slice(0, 6).map((visitor) => (
                        <div key={visitor.id} className="visitor-feed-item">
                          <div>
                            <strong>{visitor.first_name} {visitor.last_name}</strong>
                            <p className="mb-1">{visitor.student_id} · {visitor.course} {visitor.year_level}-{visitor.section}</p>
                            <span>{visitor.purpose}</span>
                          </div>
                          <div className="visitor-feed-meta">
                            <strong>{visitor.minutes_inside} min</strong>
                            <small>inside</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link to="/active" className="btn btn-outline-maroon w-100 mt-3">
                    Open full active visitor list
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="attendance-side-note">
            <p className="section-eyebrow">Desk Guide</p>
            <h4 className="mb-3">Recommended staff workflow</h4>
            <ol className="mb-0">
              <li>Search the student using the official student number.</li>
              <li>Confirm course and section before selecting the visit purpose.</li>
              <li>Use the active visitor panel to avoid duplicate open attendance records.</li>
              <li>Register the student immediately if no record exists in the database.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceLog;
