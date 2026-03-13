import React, { useEffect, useState } from 'react';
import { buildAssetUrl } from '../services/api';

function AttendanceStudentModal({
  student,
  selectedPurpose,
  matchCandidates,
  matchMode,
  searchQuery,
  isOpen,
  isSaving,
  isAttendanceClosed,
  cutoffLabel,
  onClose,
  onSelectStudent,
  onSave
}) {
  const [showImage, setShowImage] = useState(false);
  const profileImageUrl = buildAssetUrl(student?.profile_image);

  useEffect(() => {
    setShowImage(Boolean(profileImageUrl));
  }, [profileImageUrl]);

  if (!isOpen || !student) {
    return null;
  }

  const duplicateHeading = matchMode === 'same_name'
    ? 'Students with the same full name'
    : `Matching students for "${searchQuery}"`;
  const duplicateMessage = matchMode === 'same_name'
    ? 'Choose the correct record from students who share this exact name.'
    : 'This search returned multiple students. Choose the correct record from the list below.';

  return (
    <div className="student-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="attendance-student-title">
      <div className="student-profile-modal attendance-student-modal">
        <div className="student-profile-header">
          <div>
            <p className="profile-eyebrow">Student Search Result</p>
            <h3 id="attendance-student-title" className="mb-1">
              {student.first_name} {student.last_name}
            </h3>
            <p className="text-muted mb-0">
              {student.student_id} | {student.course} | Year {student.year_level}-{student.section}
            </p>
          </div>

          <div className="student-modal-actions">
            <button
              type="button"
              className="btn btn-maroon btn-sm"
              onClick={onSave}
              disabled={isSaving || !selectedPurpose || isAttendanceClosed}
            >
              {isAttendanceClosed ? `Closed at ${cutoffLabel}` : isSaving ? 'Saving...' : 'Save attendance'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="attendance-modal-grid">
            <div className="profile-side-card attendance-modal-side">
              <div className="profile-avatar-shell">
                {showImage ? (
                  <img
                    src={profileImageUrl}
                    alt={`${student.first_name} ${student.last_name}`}
                    className="profile-avatar-image"
                    onError={() => setShowImage(false)}
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    <span>{student.first_name?.[0] || 'S'}{student.last_name?.[0] || 'T'}</span>
                  </div>
                )}
              </div>

              <h4 className="mb-1">{student.first_name} {student.last_name}</h4>
              <p className="text-muted mb-4">{student.email || 'No email on file'}</p>

              <div className="profile-info-list">
                <div>
                  <span className="profile-info-label">Selected purpose</span>
                  <strong>{selectedPurpose ? selectedPurpose.shortLabel : 'No purpose selected yet'}</strong>
                </div>
                <div>
                  <span className="profile-info-label">Gender</span>
                  <strong>{student.gender}</strong>
                </div>
                <div>
                  <span className="profile-info-label">Address</span>
                  <strong>{student.address || 'No address on file'}</strong>
                </div>
              </div>
            </div>

            <div className="profile-main-card">
              <div className="profile-section-heading">
                <div>
                  <p className="profile-eyebrow">Attendance Preview</p>
                  <h5 className="mb-0">Ready for attendance confirmation</h5>
                </div>
              </div>

              <div className="attendance-modal-note">
                <strong>{isAttendanceClosed ? `Transactions closed at ${cutoffLabel}` : 'Attendance desk instructions'}</strong>
                <p className="mb-0">
                  {isAttendanceClosed
                    ? 'Search is still available, but no new attendance transaction can be saved after the cutoff.'
                    : selectedPurpose
                      ? `This student will be saved with the "${selectedPurpose.shortLabel}" purpose.`
                      : 'Choose a purpose from the left panel before saving this attendance record.'}
                </p>
              </div>

              <div className="student-preview-details attendance-modal-details">
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

              <div className="attendance-modal-purpose">
                <span className="profile-info-label">Purpose status</span>
                <strong>{selectedPurpose ? 'Ready to save attendance' : 'Purpose selection required'}</strong>
                <p className="mb-0">
                  {selectedPurpose
                    ? selectedPurpose.description
                    : 'Return to the left panel and choose one of the attendance purposes before saving.'}
                </p>
              </div>

              {matchCandidates?.length > 1 && (
                <div className="attendance-modal-duplicates">
                  <span className="profile-info-label">Search result options</span>
                  <strong>{duplicateHeading}</strong>
                  <p className="attendance-duplicate-copy">{duplicateMessage}</p>
                  <div className="attendance-match-list">
                    {matchCandidates.map((match) => {
                      const isSelected = match.student_id === student.student_id;
                      const middleName = match.middle_name ? ` ${match.middle_name}` : '';

                      return (
                        <button
                          key={match.student_id}
                          type="button"
                          className={`attendance-match-option${isSelected ? ' active' : ''}`}
                          onClick={() => onSelectStudent(match)}
                        >
                          <div>
                            <strong>{match.first_name}{middleName} {match.last_name}</strong>
                            <span>{match.student_id} | {match.course} {match.year_level}-{match.section}</span>
                          </div>
                          <small>{isSelected ? 'Selected' : 'View this student'}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceStudentModal;
