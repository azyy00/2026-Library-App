import React, { useEffect, useState } from 'react';
import StudentProfile from './StudentProfile';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import { attendanceApi, buildAssetUrl, studentApi } from '../services/api';

const MANILA_TIME_ZONE = 'Asia/Manila';

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(Number(minutes) || 0, 0);

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

  // The API returns Manila wall-clock strings ("2026-10-16 10:27:51"). Format
  // the digits as-is; converting them through a time zone would shift them.
  const match = `${value}`.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);

  if (!match) {
    return `${value}`;
  }

  const [, year, month, day, hour, minute] = match.map(Number);

  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toLocaleString([], {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getVisitorInitials = (visitor) => `${visitor?.first_name?.[0] || 'S'}${visitor?.last_name?.[0] || 'T'}`;

function ActiveVisitors() {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
      setLastUpdated(new Date().toLocaleTimeString([], {
        timeZone: MANILA_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit'
      }));
      setMessage(null);
    } catch (error) {
      console.error('Error fetching active visitors:', error);
      setMessage({
        type: 'danger',
        text: 'Unable to load active visitors right now.'
      });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
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
            <strong>{isLoading ? <Skeleton className="skeleton-stat" /> : activeVisitors.length}</strong>
            <small>Students currently inside the library.</small>
          </div>
        </div>
        <div className="col-md-6 col-xl-4">
          <div className="metric-slab">
            <span>Average stay</span>
            <strong>{isLoading ? <Skeleton className="skeleton-stat" /> : formatDuration(averageMinutes)}</strong>
            <small>Average time spent across live attendance records.</small>
          </div>
        </div>
        <div className="col-md-6 col-xl-4">
          <div className="metric-slab">
            <span>Longest stay</span>
            <strong>{isLoading ? <Skeleton className="skeleton-stat" /> : longestStayVisitor ? formatDuration(longestStayVisitor.minutes_inside) : '0 min'}</strong>
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

          {isLoading ? (
            <div className="active-visitor-list" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`visitor-skeleton-${index}`} className="active-visitor-card">
                  <div className="active-visitor-card-main">
                    <div className="active-visitor-card-copy" style={{ display: 'grid', gap: '0.4rem' }}>
                      <Skeleton width="55%" height="1.15rem" />
                      <Skeleton width="80%" height="0.85rem" />
                    </div>
                  </div>
                  <div className="active-visitor-card-actions">
                    <Skeleton width="6.5rem" height="2.1rem" radius="999px" />
                  </div>
                </article>
              ))}
            </div>
          ) : filteredVisitors.length === 0 ? (
            <EmptyState
              compact
              title={activeVisitors.length === 0 ? 'The library is quiet right now' : 'No visitors match this filter'}
              description={
                activeVisitors.length === 0
                  ? 'There are no open attendance records at the moment. New check-ins will appear here live.'
                  : 'Try a different search term or purpose to find the visitor you need.'
              }
            />
          ) : (
            <div className="active-visitor-list">
              {filteredVisitors.map((visitor) => {
                const isSelected = visitor.id === selectedVisitor?.id;
                const visitorName = [visitor.first_name, visitor.middle_name, visitor.last_name].filter(Boolean).join(' ');

                return (
                  <article key={visitor.id} className={`active-visitor-card${isSelected ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className="active-visitor-card-main"
                      onClick={() => setSelectedVisitorId(visitor.id)}
                      aria-pressed={isSelected}
                      aria-label={`View details for ${visitorName}`}
                    >
                      <div className="active-visitor-card-copy">
                        <strong className="active-visitor-card-name">{visitorName}</strong>
                        <small className="active-visitor-card-subcopy">
                          {`ID: ${visitor.student_id} | ${visitor.course || 'N/A'} ${visitor.year_level || 'N/A'}-${visitor.section || 'N/A'}`}
                        </small>
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
            <EmptyState
              title="No live visitor selected"
              description="When active attendance records appear, this board shows the selected student's details and quick actions."
            />
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
