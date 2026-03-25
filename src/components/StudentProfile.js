import React, { useEffect, useMemo, useState } from 'react';
import { buildAssetUrl } from '../services/api';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseAttendanceDateTime = (value) => {
  if (!value) {
    return null;
  }

  const stringValue = `${value}`.trim();
  const sqlMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (sqlMatch) {
    return {
      year: Number(sqlMatch[1]),
      month: Number(sqlMatch[2]),
      day: Number(sqlMatch[3]),
      hour: Number(sqlMatch[4]),
      minute: Number(sqlMatch[5])
    };
  }

  const parsedDate = new Date(stringValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
    day: parsedDate.getDate(),
    hour: parsedDate.getHours(),
    minute: parsedDate.getMinutes()
  };
};

function StudentProfile({ studentData, onClose, onEditStudent, onDeleteStudent, isDeletingStudent }) {
  const [showImage, setShowImage] = useState(false);
  const profileImageUrl = buildAssetUrl(studentData?.student?.profile_image);
  const student = studentData?.student;
  const activities = useMemo(() => studentData?.activities || [], [studentData?.activities]);
  const totalVisits = studentData?.total_visits || 0;
  const fullName = student
    ? [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' ')
    : '';

  useEffect(() => {
    setShowImage(Boolean(profileImageUrl));
  }, [profileImageUrl]);
  const latestActivity = activities[0];
  const completedActivities = useMemo(
    () => activities.filter((activity) => Boolean(activity.check_out)),
    [activities]
  );
  const activeActivities = useMemo(
    () => activities.filter((activity) => !activity.check_out),
    [activities]
  );
  const purposeBreakdown = useMemo(() => {
    const purposeMap = activities.reduce((summary, activity) => {
      const purposeKey = activity.purpose || 'Unspecified';
      summary.set(purposeKey, (summary.get(purposeKey) || 0) + 1);
      return summary;
    }, new Map());

    return Array.from(purposeMap.entries())
      .map(([purpose, count]) => ({
        purpose,
        count,
        percentage: activities.length > 0 ? Math.round((count / activities.length) * 100) : 0
      }))
      .sort((left, right) => right.count - left.count);
  }, [activities]);
  const averageStayMinutes = useMemo(() => {
    if (completedActivities.length === 0) {
      return 0;
    }

    const totalMinutes = completedActivities.reduce(
      (sum, activity) => sum + Math.max(Number(activity.duration_minutes) || 0, 0),
      0
    );

    return Math.round(totalMinutes / completedActivities.length);
  }, [completedActivities]);
  const favoritePurpose = purposeBreakdown[0]?.purpose || 'No data';

  if (!studentData || !student) {
    return null;
  }

  const formatTime = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }

    const parsedValue = parseAttendanceDateTime(dateString);

    if (!parsedValue) {
      return `${dateString}`;
    }

    const suffix = parsedValue.hour >= 12 ? 'PM' : 'AM';
    const displayHour = parsedValue.hour % 12 || 12;

    return `${MONTH_LABELS[parsedValue.month - 1]} ${parsedValue.day}, ${parsedValue.year}, ${displayHour}:${`${parsedValue.minute}`.padStart(2, '0')} ${suffix}`;
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) {
      return 'Ongoing';
    }

    const safeMinutes = Math.max(Number(minutes) || 0, 0);

    if (safeMinutes < 60) {
      return `${safeMinutes} min`;
    }

    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
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
              {student.student_id} | {student.course} | Year {student.year_level}-{student.section}
            </p>
          </div>

          <div className="student-modal-actions">
            {onEditStudent && (
              <button
                type="button"
                className="btn btn-outline-maroon btn-sm"
                onClick={() => onEditStudent(student)}
              >
                Edit student
              </button>
            )}
            {onDeleteStudent && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => onDeleteStudent(student)}
                disabled={isDeletingStudent}
              >
                {isDeletingStudent ? 'Deleting...' : 'Delete student'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </button>
          </div>
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
                    <strong>{latestActivity ? formatTime(latestActivity.check_out || latestActivity.check_in) : 'No visit yet'}</strong>
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
                  <>
                    <div className="profile-analytics-grid">
                      <div className="profile-analytics-card">
                        <span className="profile-analytics-label">Completed visits</span>
                        <strong>{completedActivities.length}</strong>
                        <small>Finished library sessions</small>
                      </div>

                      <div className="profile-analytics-card">
                        <span className="profile-analytics-label">Active visits</span>
                        <strong>{activeActivities.length}</strong>
                        <small>Open attendance records</small>
                      </div>

                      <div className="profile-analytics-card">
                        <span className="profile-analytics-label">Average stay</span>
                        <strong>{formatDuration(averageStayMinutes)}</strong>
                        <small>Across completed visits</small>
                      </div>

                      <div className="profile-analytics-card">
                        <span className="profile-analytics-label">Favorite purpose</span>
                        <strong>{favoritePurpose}</strong>
                        <small>Most common visit reason</small>
                      </div>
                    </div>

                    <div className="profile-purpose-breakdown">
                      <div className="profile-purpose-breakdown-header">
                        <span className="profile-analytics-label">Purpose analytics</span>
                        <strong>{purposeBreakdown.length} recorded purpose{purposeBreakdown.length === 1 ? '' : 's'}</strong>
                      </div>

                      <div className="profile-purpose-breakdown-list">
                        {purposeBreakdown.map((purposeItem) => (
                          <div key={purposeItem.purpose} className="profile-purpose-breakdown-row">
                            <div className="profile-purpose-breakdown-copy">
                              <span>{purposeItem.purpose}</span>
                              <small>{purposeItem.count} visit{purposeItem.count === 1 ? '' : 's'}</small>
                            </div>
                            <div className="profile-purpose-breakdown-bar">
                              <div
                                className="profile-purpose-breakdown-bar-fill"
                                style={{ width: `${purposeItem.percentage}%` }}
                              />
                            </div>
                            <strong>{purposeItem.percentage}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table align-middle profile-table">
                        <thead>
                          <tr>
                            <th>Time in</th>
                            <th>Time out</th>
                            <th>Purpose</th>
                            <th>Status</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.map((activity) => (
                            <tr key={activity.id}>
                              <td>{formatTime(activity.check_in)}</td>
                              <td>{activity.check_out ? formatTime(activity.check_out) : 'Still inside'}</td>
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
                  </>
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
