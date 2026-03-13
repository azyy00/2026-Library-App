import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceStudentModal from './AttendanceStudentModal';
import { attendanceApi, buildAssetUrl, studentApi } from '../services/api';

const PURPOSE_OPTIONS = [
  {
    value: 'Study',
    shortLabel: 'Study',
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

const CUTOFF_HOUR = 17;
const CUTOFF_MINUTE = 0;
const CUTOFF_LABEL = '5:00 PM';

const isAfterCutoffTime = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return hours > CUTOFF_HOUR || (hours === CUTOFF_HOUR && minutes >= CUTOFF_MINUTE);
};

const getStudentNameKey = (studentRecord) =>
  [studentRecord?.first_name, studentRecord?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();

function AttendanceLog() {
  const [studentId, setStudentId] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [purpose, setPurpose] = useState('');
  const [student, setStudent] = useState(null);
  const [searchMatches, setSearchMatches] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenTime, setScreenTime] = useState(new Date());
  const [showStudentImage, setShowStudentImage] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const isAttendanceClosed = isAfterCutoffTime(screenTime);

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

  useEffect(() => {
    if (isAttendanceClosed) {
      fetchActiveVisitors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAttendanceClosed]);

  const fetchActiveVisitors = async (initialLoad = false) => {
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
    }
  };

  const resetAttendanceForm = (preserveFeedback = false) => {
    setStudentId('');
    setActiveSearchQuery('');
    setStudent(null);
    setSearchMatches([]);
    setPurpose('');
    setSearchAttempted(false);
    setShowStudentImage(false);
    setIsStudentModalOpen(false);

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
    setActiveSearchQuery(query);

    try {
      const response = await studentApi.search(query);
      setSearchMatches(response.data);
      const exactMatch = response.data.find((item) => item.student_id === query);
      const matchedStudent = exactMatch || response.data[0] || null;

      if (!matchedStudent) {
        setStudent(null);
        setSearchMatches([]);
        setIsStudentModalOpen(false);
        setFeedback({
          type: 'warning',
          text: 'No student matched that search. You can register the student if needed.'
        });
        return;
      }

      setStudent(matchedStudent);
      setIsStudentModalOpen(true);
      setFeedback({
        type: 'info',
        text: `Student record loaded for ${matchedStudent.first_name} ${matchedStudent.last_name}.`
      });
    } catch (error) {
      console.error('Search error:', error);
      setStudent(null);
      setSearchMatches([]);
      setIsStudentModalOpen(false);
      setFeedback({
        type: 'danger',
        text: error.response?.data?.error || 'Error searching for student.'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCheckIn = async () => {
    if (isAttendanceClosed) {
      setFeedback({
        type: 'warning',
        text: `Attendance transactions close at ${CUTOFF_LABEL}. Active visitors are checked out automatically at the cutoff.`
      });
      return;
    }

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
      setIsStudentModalOpen(false);
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
  const sameNameMatches = student
    ? searchMatches.filter((item) => getStudentNameKey(item) === getStudentNameKey(student))
    : [];
  const modalMatchMode = sameNameMatches.length > 1
    ? 'same_name'
    : searchMatches.length > 1
      ? 'search_results'
      : 'single';
  const modalMatchCandidates = modalMatchMode === 'same_name'
    ? sameNameMatches
    : modalMatchMode === 'search_results'
      ? searchMatches
      : [];
  const heroDate = screenTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const deskTime = screenTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="attendance-desk-shell">
      <section className="attendance-banner">
        <p className="attendance-banner-kicker">Goa Community College Library</p>
        <h1>ATTENDANCE</h1>
        <div className="attendance-banner-meta">
          <span>{heroDate}</span>
          <span>{deskTime}</span>
          <span>{isAttendanceClosed ? `Closed after ${CUTOFF_LABEL}` : `Open until ${CUTOFF_LABEL}`}</span>
        </div>
      </section>

      <section className="attendance-workspace-panel">
        <div className="attendance-desk-grid">
          <aside className="attendance-control-panel">
            <div className="attendance-control-head">
              <p className="section-eyebrow">The Active Desk</p>
              <h3>The active desk</h3>
              <p className="text-muted mb-0">
                Select a purpose, load the student record, then save the attendance transaction from this panel.
              </p>
            </div>

            <div className="attendance-control-stat">
              <span>Open visitors</span>
              <strong>{activeVisitors.length}</strong>
              <small>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for live data'}</small>
            </div>

            <div className="attendance-purpose-card">
              <h4>Select Purpose</h4>
              <div className="purpose-grid attendance-purpose-grid">
                {PURPOSE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`purpose-option ${purpose === option.value ? 'purpose-option-active' : ''} ${isAttendanceClosed ? 'purpose-option-disabled' : ''}`}
                    onClick={() => setPurpose(option.value)}
                    disabled={isAttendanceClosed}
                  >
                    <strong>{option.shortLabel}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="attendance-control-actions">
              <button
                type="button"
                className="btn btn-maroon"
                onClick={handleCheckIn}
                disabled={isSubmitting || !purpose || !student || isAttendanceClosed}
              >
                {isAttendanceClosed ? `Closed at ${CUTOFF_LABEL}` : isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => resetAttendanceForm()}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>

            <div className="attendance-control-note">
              <span>Current purpose</span>
              <strong>{selectedPurpose ? selectedPurpose.shortLabel : 'No purpose selected'}</strong>
              <small>{selectedPurpose ? selectedPurpose.description : 'Pick one of the attendance categories.'}</small>
            </div>
          </aside>

          <div className="attendance-main-panel">
            <div className="attendance-search-strip">
              <div className="attendance-search-copy">
                <p className="section-eyebrow">Search Student</p>
                <h3>Search student</h3>
              </div>

              <div className="input-group attendance-search-group">
                <input
                  type="text"
                  className="form-control"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="Enter ID or Name"
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
            </div>

            <div className="attendance-status-grid">
              <div className="attendance-desk-card">
                <span className="summary-label">Active now</span>
                <strong>{activeVisitors.length}</strong>
                <small>Students currently inside the library.</small>
              </div>
              <div className="attendance-desk-card">
                <span className="summary-label">Selected purpose</span>
                <strong>{selectedPurpose ? selectedPurpose.shortLabel : 'Not selected'}</strong>
                <small>{selectedPurpose ? selectedPurpose.description : 'Choose the visit purpose before saving.'}</small>
              </div>
              <div className="attendance-desk-card">
                <span className="summary-label">Current status</span>
                <strong>{isAttendanceClosed ? 'Desk closed after 5:00 PM' : student ? 'Record ready to save' : 'Waiting for search'}</strong>
                <small>
                  {isAttendanceClosed
                    ? 'New attendance transactions are disabled after the cutoff.'
                    : student
                      ? `${student.first_name} ${student.last_name} is loaded for attendance.`
                      : 'Search by student ID or full name.'}
                </small>
              </div>
            </div>

            {isAttendanceClosed && (
              <div className="alert alert-warning attendance-alert" role="alert">
                Attendance transactions are closed after {CUTOFF_LABEL}. Any visitor still active at the cutoff is checked out automatically.
              </div>
            )}

            {feedback && (
              <div className={`alert alert-${feedback.type} attendance-alert`} role="alert">
                {feedback.text}
              </div>
            )}

            <div className="attendance-main-grid">
              <div className="attendance-guide-card">
                <p className="section-eyebrow">Desktop Guide</p>
                <h4>Desk top guide here</h4>
                <ol className="mb-0">
                  <li>Search the student using the official student number when possible.</li>
                  <li>Confirm the purpose on the left panel before saving the attendance record.</li>
                  <li>Review course and section details in the student preview before final submission.</li>
                  <li>Open the active visitor list below when you need a full live view of open visits.</li>
                </ol>

                <Link to="/active" className="btn btn-outline-maroon mt-4">
                  Open full active visitor list
                </Link>
              </div>

              <div className="attendance-student-stage">
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
                        <p className="section-eyebrow mb-2">Loaded student</p>
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

                    <div className="attendance-student-note">
                      <strong>{isAttendanceClosed ? `Transactions closed at ${CUTOFF_LABEL}` : 'Ready for attendance save'}</strong>
                      <p className="mb-0">
                        {isAttendanceClosed
                          ? 'Search remains available, but no new attendance transactions can be saved after the cutoff.'
                          : 'If everything looks correct, use the Save button in the left panel to record this visit.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="attendance-empty-state attendance-student-empty">
                    <h5 className="mb-2">No student selected yet</h5>
                    <p className="text-muted mb-3">
                      Search the student record on the top right, then return to the left panel to save the attendance entry.
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
          </div>
        </div>
      </section>

      <AttendanceStudentModal
        student={student}
        selectedPurpose={selectedPurpose}
        matchCandidates={modalMatchCandidates}
        matchMode={modalMatchMode}
        searchQuery={activeSearchQuery}
        isOpen={isStudentModalOpen}
        isSaving={isSubmitting}
        isAttendanceClosed={isAttendanceClosed}
        cutoffLabel={CUTOFF_LABEL}
        onClose={() => setIsStudentModalOpen(false)}
        onSelectStudent={setStudent}
        onSave={handleCheckIn}
      />
    </div>
  );
}

export default AttendanceLog;
