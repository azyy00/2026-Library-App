import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentApi } from '../services/api';

function StudentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  const handleSearch = async () => {
    try {
      const response = await studentApi.search(searchTerm);
      setResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search by ID or Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>
        
        <div className="list-group">
          {results.length === 0 ? (
            <div className="text-center">
              <p>No students found</p>
              <button 
                className="btn btn-success"
                onClick={() => navigate('/register')}
              >
                Register New Student
              </button>
            </div>
          ) : (
            results.map(student => (
              <button
                key={student.id}
                className="list-group-item list-group-item-action"
                onClick={() => navigate(`/profile/${student.id}`)}
              >
                {student.name} - {student.student_id} ({student.program})
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentSearch;
