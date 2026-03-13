import React, { useEffect, useState } from 'react';
import { attendanceApi } from '../services/api';

function ActiveVisitors() {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [message, setMessage] = useState(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchActiveVisitors(true);
  }, []);

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

  const handleCheckout = async (id) => {
    setCheckingOutId(id);

    try {
      await attendanceApi.checkOut(id);
      setMessage({ type: 'success', text: 'Visitor checked out successfully.' });
      fetchActiveVisitors();
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

  const query = filterTerm.trim().toLowerCase();
  const filteredVisitors = !query
    ? activeVisitors
    : activeVisitors.filter((visitor) => {
        const searchable = [
          visitor.student_id,
          visitor.first_name,
          visitor.last_name,
          visitor.course,
          visitor.purpose
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(query);
      });

  const totalMinutes = activeVisitors.reduce((sum, visitor) => sum + (visitor.minutes_inside || 0), 0);

  return (
    <div className="container mt-4">
      <section className="page-hero-card">
        <div>
          <p className="section-eyebrow">Live Monitoring</p>
          <h2 className="mb-1">Active library visitors</h2>
          <p className="text-muted mb-0">
            Review open attendance records and complete check-out when students leave the library.
          </p>
        </div>
        <div className="page-hero-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => fetchActiveVisitors()}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh list'}
          </button>
        </div>
      </section>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="metric-slab">
            <span>Open visits</span>
            <strong>{activeVisitors.length}</strong>
            <small>Students currently inside the library.</small>
          </div>
        </div>
        <div className="col-md-4">
          <div className="metric-slab">
            <span>Tracked minutes</span>
            <strong>{totalMinutes}</strong>
            <small>Combined minutes across all open visits.</small>
          </div>
        </div>
        <div className="col-md-4">
          <div className="metric-slab">
            <span>Last refresh</span>
            <strong>{lastUpdated || 'Pending'}</strong>
            <small>Use refresh before closing a visit from this page.</small>
          </div>
        </div>
      </div>

      <div className="attendance-panel">
        <div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-4">
          <div>
            <p className="section-eyebrow">Visitor Queue</p>
            <h4 className="mb-1">Open attendance records</h4>
            <p className="text-muted mb-0">{filteredVisitors.length} record(s) shown.</p>
          </div>
          <div className="visitor-filter">
            <input
              type="text"
              className="form-control"
              value={filterTerm}
              onChange={(event) => setFilterTerm(event.target.value)}
              placeholder="Filter by ID, name, course, or purpose"
            />
          </div>
        </div>

        {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        {filteredVisitors.length === 0 ? (
          <div className="attendance-empty-state compact">
            <h5 className="mb-2">No matching active visitors</h5>
            <p className="mb-0 text-muted">
              {activeVisitors.length === 0
                ? 'There are no open attendance records at the moment.'
                : 'Try a different filter term to find the visitor you need.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle visitor-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Academic info</th>
                  <th>Purpose</th>
                  <th>Check-in</th>
                  <th>Duration</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.map((visitor) => (
                  <tr key={visitor.id}>
                    <td>
                      <strong>{visitor.first_name} {visitor.last_name}</strong>
                      <div className="text-muted small">{visitor.student_id}</div>
                    </td>
                    <td>{visitor.course} {visitor.year_level}-{visitor.section}</td>
                    <td>
                      <span className="purpose-badge">{visitor.purpose}</span>
                    </td>
                    <td>{new Date(visitor.check_in).toLocaleString()}</td>
                    <td>{visitor.minutes_inside} min</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-maroon btn-sm"
                        onClick={() => handleCheckout(visitor.id)}
                        disabled={checkingOutId === visitor.id}
                      >
                        {checkingOutId === visitor.id ? 'Checking out...' : 'Check out'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActiveVisitors;
