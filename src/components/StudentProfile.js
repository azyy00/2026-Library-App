import React, { useEffect, useState } from 'react';
import { buildAssetUrl } from '../services/api';

function StudentProfile({ studentData, onClose }) {
  const [showImage, setShowImage] = useState(false);
  const profileImageUrl = buildAssetUrl(studentData?.student?.profile_image);

  useEffect(() => {
    setShowImage(Boolean(profileImageUrl));
  }, [profileImageUrl]);

  if (!studentData) {
    return null;
  }

  const { student, activities, total_visits: totalVisits } = studentData;
  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');
  const latestActivity = activities[0];

  const formatTime = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }

    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) {
      return 'Ongoing';
    }

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="student-profile-overlay" role="dialog" aria-modal="true">
      <div className="student-profile-modal">
        <div className="student-profile-header">
          <div>
            <p className="profile-eyebrow">Student Activity Profile</p>
            <h3 className="mb-1">{fullName}</h3>
            <p className="text-muted mb-0">
              {student.student_id} · {student.course} · Year {student.year_level}-{student.section}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="row g-4 mb-4">
            <div className="col-lg-4">
              <div className="profile-side-card">
                <div className="profile-avatar-shell">
                  {showImage ? (
                    <img
                      src={profileImageUrl}
                      alt={fullName}
                      className="profile-avatar-image"
                      onError={() => setShowImage(false)}
                    />
                  ) : (
                    <div className="profile-avatar-fallback">
                      <span>{student.first_name?.[0] || 'S'}{student.last_name?.[0] || 'T'}</span>
                    </div>
                  )}
                </div>

                <h4 className="mb-1">{fullName}</h4>
                <p className="text-muted mb-4">{student.email || 'No email on file'}</p>

                <div className="profile-stat-grid">
                  <div className="profile-stat-card">
                    <span className="profile-stat-value">{totalVisits}</span>
                    <span className="profile-stat-label">Total visits</span>
                  </div>
                  <div className="profile-stat-card">
                    <span className="profile-stat-value">{activities.length}</span>
                    <span className="profile-stat-label">Recent logs</span>
                  </div>
                </div>

                <div className="profile-info-list">
                  <div>
                    <span className="profile-info-label">Gender</span>
                    <strong>{student.gender}</strong>
                  </div>
                  <div>
                    <span className="profile-info-label">Address</span>
                    <strong>{student.address || 'No address on file'}</strong>
                  </div>
                  <div>
                    <span className="profile-info-label">Last visit</span>
                    <strong>{latestActivity ? formatTime(latestActivity.check_in) : 'No visit yet'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="profile-main-card">
                <div className="profile-section-heading">
                  <div>
                    <p className="profile-eyebrow">Attendance Summary</p>
                    <h5 className="mb-0">Recent library activity</h5>
                  </div>
                </div>

                {activities.length === 0 ? (
                  <div className="profile-empty-state">
                    <h6 className="mb-2">No attendance history yet</h6>
                    <p className="mb-0 text-muted">
                      This student is registered, but no library attendance record has been created.
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle profile-table">
                      <thead>
                        <tr>
                          <th>Date and time</th>
                          <th>Purpose</th>
                          <th>Status</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((activity) => (
                          <tr key={activity.id}>
                            <td>{formatTime(activity.check_in)}</td>
                            <td>
                              <span className="purpose-badge">{activity.purpose}</span>
                            </td>
                            <td>
                              <span className={`status-pill ${activity.check_out ? 'status-complete' : 'status-live'}`}>
                                {activity.check_out ? 'Completed' : 'Active'}
                              </span>
                            </td>
                            <td>{formatDuration(activity.duration_minutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentProfile;
