import React, { useEffect, useState } from 'react';
import StudentProfile from './StudentProfile';
import { attendanceApi, buildAssetUrl, studentApi } from '../services/api';

const formatDuration = (minutes) => {
  const safeMinutes = Number(minutes) || 0;

  if (safeMinutes < 60) {
    return `${safeMinutes} min`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Pending';
  }

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getVisitorInitials = (visitor) => `${visitor?.first_name?.[0] || 'S'}${visitor?.last_name?.[0] || 'T'}`;

function ActiveVisitors() {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [message, setMessage] = useState(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [activePurpose, setActivePurpose] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const fetchActiveVisitors = async (initialLoad = false) => {
    if (!initialLoad) {
      setIsRefreshing(true);
    }

    try {
      const response = await attendanceApi.getActive();
      setActiveVisitors(response.data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setMessage(null);
    } catch (error) {
      console.error('Error fetching active visitors:', error);
      setMessage({
        type: 'danger',
        text: 'Unable to load active visitors right now.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActiveVisitors(true);
  }, []);

  const query = filterTerm.trim().toLowerCase();
  const purposeCounts = activeVisitors.reduce((totals, visitor) => {
    const purpose = visitor.purpose || 'Unassigned';
    totals[purpose] = (totals[purpose] || 0) + 1;
    return totals;
  }, {});
  const purposeFilters = Object.entries(purposeCounts).sort((left, right) => right[1] - left[1]);

  const filteredVisitors = activeVisitors.filter((visitor) => {
    const matchesPurpose = activePurpose === 'all' || visitor.purpose === activePurpose;

    if (!matchesPurpose) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      visitor.student_id,
      visitor.first_name,
      visitor.middle_name,
      visitor.last_name,
      visitor.course,
      visitor.section,
      visitor.purpose,
      visitor.email
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });

  useEffect(() => {
    if (filteredVisitors.length === 0) {
      if (selectedVisitorId !== null) {
        setSelectedVisitorId(null);
      }
      return;
    }

    const isStillVisible = filteredVisitors.some((visitor) => visitor.id === selectedVisitorId);

    if (!isStillVisible) {
      setSelectedVisitorId(filteredVisitors[0].id);
    }
  }, [filteredVisitors, selectedVisitorId]);

  const selectedVisitor = filteredVisitors.find((visitor) => visitor.id === selectedVisitorId)
    || activeVisitors.find((visitor) => visitor.id === selectedVisitorId)
    || filteredVisitors[0]
    || null;

  const totalMinutes = activeVisitors.reduce((sum, visitor) => sum + (visitor.minutes_inside || 0), 0);
  const averageMinutes = activeVisitors.length ? Math.round(totalMinutes / activeVisitors.length) : 0;
  const longestStayVisitor = activeVisitors.reduce((best, visitor) => (
    !best || (visitor.minutes_inside || 0) > (best.minutes_inside || 0) ? visitor : best
  ), null);

  const handleCheckout = async (id) => {
    setCheckingOutId(id);

    try {
      await attendanceApi.checkOut(id);
      setMessage({ type: 'success', text: 'Visitor checked out successfully.' });
      await fetchActiveVisitors();
    } catch (error) {
      console.error('Check-out error:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.error || 'Error during check-out.'
      });
    } finally {
      setCheckingOutId(null);
    }
  };

  const handleOpenProfile = async () => {
    if (!selectedVisitor) {
      return;
    }

    setIsProfileLoading(true);

    try {
      const response = await studentApi.getProfile(selectedVisitor.student_id);
      setProfileData(response.data);
    } catch (error) {
      console.error('Error loading student profile:', error);
      setMessage({
        type: 'danger',
        text: 'Unable to open the student profile right now.'
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const selectedVisitorImage = buildAssetUrl(selectedVisitor?.profile_image);
  const selectedVisitorName = selectedVisitor
    ? [selectedVisitor.first_name, selectedVisitor.middle_name, selectedVisitor.last_name].filter(Boolean).join(' ')
    : '';

  return (
    <div className="container mt-4 active-visitors-shell">
      <section className="attendance-hero active-visitors-hero">
        <div className="attendance-hero-copy">
          <p className="section-eyebrow mb-2 text-white-50">Live Monitoring</p>
          <h2 className="attendance-hero-title">Active visitor command desk</h2>
          <p className="attendance-hero-text mb-0">
            Track open attendance records, inspect the selected student, and complete check-out from one live workspace.
          </p>

          <div className="attendance-hero-meta">
            <span>{activeVisitors.length} open visit(s)</span>
            <span>Last refresh: {lastUpdated || 'Pending'}</span>
          </div>
        </div>

        <div className="page-hero-actions active-visitors-actions">
          <button
            type="button"
            className="btn btn-light"
            onClick={() => fetchActiveVisitors()}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh list'}
          </button>
        </div>
      </section>

      {message && <div className={`alert alert-${message.type} mb-4`}>{message.text}</div>}

      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-4">
          <div className="metric-slab">
            <span>Open visits</span>
            <strong>{activeVisitors.length}</strong>
            <small>Students currently inside the library.</small>
          </div>
        </div>
        <div className="col-md-6 col-xl-4">
          <div className="metric-slab">
            <span>Average stay</span>
            <strong>{formatDuration(averageMinutes)}</strong>
            <small>Average time spent across live attendance records.</small>
          </div>
        </div>
        <div className="col-md-6 col-xl-4">
          <div className="metric-slab">
            <span>Longest stay</span>
            <strong>{longestStayVisitor ? formatDuration(longestStayVisitor.minutes_inside) : '0 min'}</strong>
            <small>{longestStayVisitor ? `${longestStayVisitor.first_name} ${longestStayVisitor.last_name}` : 'Waiting for the first visitor.'}</small>
          </div>
        </div>
      </div>

      <div className="active-visitors-grid">
        <section className="attendance-panel active-visitor-queue-panel">
          <div className="profile-section-heading active-visitor-heading">
            <div>
              <p className="section-eyebrow mb-2">Visitor Queue</p>
              <h4 className="mb-1">Open attendance records</h4>
              <p className="text-muted mb-0">
                {filteredVisitors.length} record(s) shown for review.
              </p>
            </div>

            <div className="visitor-filter active-visitor-search">
              <input
                type="text"
                className="form-control"
                value={filterTerm}
                onChange={(event) => setFilterTerm(event.target.value)}
                placeholder="Search by ID, name, email, course, or purpose"
              />
            </div>
          </div>

          <div className="active-purpose-chips">
            <button
              type="button"
              className={`active-purpose-chip${activePurpose === 'all' ? ' active' : ''}`}
              onClick={() => setActivePurpose('all')}
            >
              <span>All visitors</span>
              <small>{activeVisitors.length}</small>
            </button>

            {purposeFilters.map(([purpose, count]) => (
              <button
                key={purpose}
                type="button"
                className={`active-purpose-chip${activePurpose === purpose ? ' active' : ''}`}
                onClick={() => setActivePurpose(purpose)}
              >
                <span>{purpose}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>

          {filteredVisitors.length === 0 ? (
            <div className="attendance-empty-state compact">
              <h5 className="mb-2">No matching active visitors</h5>
              <p className="mb-0 text-muted">
                {activeVisitors.length === 0
                  ? 'There are no open attendance records at the moment.'
                  : 'Try a different filter term or purpose to find the visitor you need.'}
              </p>
            </div>
          ) : (
            <div className="active-visitor-list">
              {filteredVisitors.map((visitor) => {
                const isSelected = visitor.id === selectedVisitor?.id;
                const visitorImageUrl = buildAssetUrl(visitor.profile_image);
                const visitorName = [visitor.first_name, visitor.middle_name, visitor.last_name].filter(Boolean).join(' ');

                return (
                  <article key={visitor.id} className={`active-visitor-card${isSelected ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className="active-visitor-card-main"
                      onClick={() => setSelectedVisitorId(visitor.id)}
                    >
                      <div className="dashboard-student-cell">
                        <div className="dashboard-student-avatar active-visitor-avatar">
                          {visitorImageUrl ? (
                            <img src={visitorImageUrl} alt={visitorName} />
                          ) : (
                            <span>{getVisitorInitials(visitor)}</span>
                          )}
                        </div>

                        <div>
                          <strong>{visitorName}</strong>
                          <small>{visitor.student_id} | {visitor.course} {visitor.year_level}-{visitor.section}</small>
                        </div>
                      </div>

                      <div className="active-visitor-card-meta">
                        <span className="purpose-badge">{visitor.purpose}</span>
                        <span>{formatDuration(visitor.minutes_inside)}</span>
                        <span>Checked in {formatDateTime(visitor.check_in)}</span>
                      </div>
                    </button>

                    <div className="active-visitor-card-actions">
                      <button
                        type="button"
                        className="btn btn-maroon btn-sm"
                        onClick={() => handleCheckout(visitor.id)}
                        disabled={checkingOutId === visitor.id}
                      >
                        {checkingOutId === visitor.id ? 'Checking out...' : 'Check out'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="attendance-panel active-visitor-detail-panel">
          {selectedVisitor ? (
            <>
              <div className="profile-section-heading active-visitor-heading">
                <div>
                  <p className="section-eyebrow mb-2">Detail Board</p>
                  <h4 className="mb-1">Selected visitor</h4>
                  <p className="text-muted mb-0">
                    Review the live attendance record before completing check-out.
                  </p>
                </div>
                <span className="purpose-badge">{selectedVisitor.purpose}</span>
              </div>

              <div className="active-visitor-profile-card">
                <div className="dashboard-student-avatar active-visitor-profile-avatar">
                  {selectedVisitorImage ? (
                    <img src={selectedVisitorImage} alt={selectedVisitorName} />
                  ) : (
                    <span>{getVisitorInitials(selectedVisitor)}</span>
                  )}
                </div>

                <div>
                  <h3 className="mb-1">{selectedVisitorName}</h3>
                  <p className="text-muted mb-0">
                    {selectedVisitor.student_id} | {selectedVisitor.course} | Year {selectedVisitor.year_level}-{selectedVisitor.section}
                  </p>
                </div>
              </div>

              <div className="active-visitor-status-grid">
                <div className="active-visitor-mini-card">
                  <span>Time inside</span>
                  <strong>{formatDuration(selectedVisitor.minutes_inside)}</strong>
                  <small>Updated each time the list refreshes.</small>
                </div>
                <div className="active-visitor-mini-card">
                  <span>Checked in</span>
                  <strong>{formatDateTime(selectedVisitor.check_in)}</strong>
                  <small>Open since the recorded check-in time.</small>
                </div>
              </div>

              <div className="student-preview-details active-visitor-detail-grid">
                <div>
                  <span>Course</span>
                  <strong>{selectedVisitor.course}</strong>
                </div>
                <div>
                  <span>Year and section</span>
                  <strong>{selectedVisitor.year_level}-{selectedVisitor.section}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedVisitor.email || 'No email on file'}</strong>
                </div>
                <div>
                  <span>Gender</span>
                  <strong>{selectedVisitor.gender || 'Not specified'}</strong>
                </div>
                <div>
                  <span>Address</span>
                  <strong>{selectedVisitor.address || 'No address on file'}</strong>
                </div>
              </div>

              <div className="active-visitor-detail-actions">
                <button
                  type="button"
                  className="btn btn-maroon"
                  onClick={() => handleCheckout(selectedVisitor.id)}
                  disabled={checkingOutId === selectedVisitor.id}
                >
                  {checkingOutId === selectedVisitor.id ? 'Checking out...' : 'Check out now'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-maroon"
                  onClick={handleOpenProfile}
                  disabled={isProfileLoading}
                >
                  {isProfileLoading ? 'Loading profile...' : 'View full profile'}
                </button>
              </div>
            </>
          ) : (
            <div className="attendance-empty-state">
              <h5 className="mb-2">No live visitor selected</h5>
              <p className="mb-0 text-muted">
                When active attendance records appear, this board will show the selected student details and quick actions.
              </p>
            </div>
          )}
        </aside>
      </div>

      {profileData && (
        <StudentProfile
          studentData={profileData}
          onClose={() => setProfileData(null)}
        />
      )}
    </div>
  );
}

export default ActiveVisitors;
