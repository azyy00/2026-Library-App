import React, { useState } from 'react';
import { studentApi } from '../services/api';

function Dashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [student, setStudent] = useState(null);

  const handleSearch = async () => {
    try {
      const response = await studentApi.search(searchTerm);
      setStudent(response.data[0] || null);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className="container mt-4">
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Search Student</h5>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Student ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleSearch}>
                  Search
                </button>
              </div>
              {student && (
                <div className="mt-3">
                  <h6>Student Information</h6>
                  <p>Name: {student.first_name} {student.last_name}</p>
                  <p>Course: {student.course}</p>
                  <p>Year & Section: {student.year_level}-{student.section}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
