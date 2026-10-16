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
    value: 'Computer/Internet',
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

const MANILA_TIME_ZONE = 'Asia/Manila';

// The backend enforces the cutoff in Manila time, so the desk must read the same
// clock regardless of the time zone configured on the desk computer.
const getManilaClock = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);

  return { hours: read('hour'), minutes: read('minute') };
};

const formatManilaTime = (date) => date.toLocaleTimeString([], {
  timeZone: MANILA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit'
});

const isAfterCutoffTime = (date) => {
  const { hours, minutes } = getManilaClock(date);

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
      setLastUpdated(formatManilaTime(new Date()));
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
        text: `${response.data.student_name} checked in successfully at ${formatManilaTime(new Date())}.`
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
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const deskTime = formatManilaTime(screenTime);

  return (
    <div className="attendance-desk-shell">
      <section className="attendance-banner">
        <p className="attendance-banner-kicker">Goa Community College Library</p>
        <p className="attendance-banner-title" aria-hidden="true">ATTENDANCE</p>
        <div className="attendance-banner-meta">
          <span>{heroDate}</span>
          <span>{deskTime}</span>
          <span>{isAttendanceClosed ? `Closed after ${CUTOFF_LABEL}` : `Open until ${CUTOFF_LABEL}`}</span>
        </div>
      </section>

      <section className="attendance-workspace-panel">
        <div className="attendance-desk-grid">
          <div className="attendance-flow">
            <div className="attendance-step">
              <div className="attendance-step-head">
                <span className="attendance-step-number" aria-hidden="true">1</span>
                <label htmlFor="attendance-search-input">Find the student</label>
              </div>
              <div className="input-group attendance-search-group">
                <input
                  id="attendance-search-input"
                  type="search"
                  className="form-control"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="Student ID or full name"
                  autoComplete="off"
                  enterKeyHint="search"
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
              <small className="attendance-step-hint">The student number gives the most exact match.</small>
            </div>

            <div className="attendance-step">
              <div className="attendance-step-head">
                <span className="attendance-step-number" aria-hidden="true">2</span>
                <span id="attendance-purpose-label">Choose the visit purpose</span>
              </div>
              <div
                className="purpose-grid attendance-purpose-grid"
                role="radiogroup"
                aria-labelledby="attendance-purpose-label"
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={purpose === option.value}
                    className={`purpose-option ${purpose === option.value ? 'purpose-option-active' : ''} ${isAttendanceClosed ? 'purpose-option-disabled' : ''}`}
                    onClick={() => setPurpose(option.value)}
                    disabled={isAttendanceClosed}
                  >
                    <strong>{option.shortLabel}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="attendance-step">
              <div className="attendance-step-head">
                <span className="attendance-step-number" aria-hidden="true">3</span>
                <span>Save the visit</span>
              </div>
              <div className="attendance-control-actions">
                <button
                  type="button"
                  className="btn btn-maroon"
                  onClick={handleCheckIn}
                  disabled={isSubmitting || !purpose || !student || isAttendanceClosed}
                >
                  {isAttendanceClosed ? `Closed at ${CUTOFF_LABEL}` : isSubmitting ? 'Saving...' : 'Save check-in'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => resetAttendanceForm()}
                  disabled={isSubmitting}
                >
                  Clear
                </button>
              </div>
              <small className="attendance-step-hint" aria-live="polite">
                {isAttendanceClosed
                  ? 'New check-ins are disabled after the cutoff.'
                  : !student && !purpose
                    ? 'Find a student and choose a purpose to enable saving.'
                    : !student
                      ? 'Find a student to enable saving.'
                      : !purpose
                        ? 'Choose a purpose to enable saving.'
                        : `Ready to check in ${student.first_name} ${student.last_name} for ${selectedPurpose.shortLabel.toLowerCase()}.`}
              </small>
            </div>

            {isAttendanceClosed && (
              <div className="alert alert-warning attendance-alert mb-0" role="alert">
                Attendance transactions are closed after {CUTOFF_LABEL}. Any visitor still active at the cutoff is checked out automatically.
              </div>
            )}

            {feedback && (
              <div className={`alert alert-${feedback.type} attendance-alert mb-0`} role="alert">
                {feedback.text}
              </div>
            )}
          </div>

          <div className="attendance-side">
            <div className="attendance-live-strip">
              <div>
                <span className="summary-label">Inside the library</span>
                <strong>{activeVisitors.length}</strong>
                <small>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for live data'}</small>
              </div>
              <Link to="/active" className="btn btn-outline-maroon">
                View visitors
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
                </div>
              ) : (
                <div className="attendance-empty-state attendance-student-empty">
                  <h5 className="mb-2">No student loaded</h5>
                  <p className="text-muted mb-3">
                    Search by student number or name. The matching record appears here for a final check before saving.
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
