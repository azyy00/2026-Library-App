import React, { useState } from 'react';
import { studentApi } from '../services/api';

function StudentForm() {
  const [formData, setFormData] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    address: '',
    email: '',
    gender: '',
    course: '',
    year: '',
    section: '',
    profile_image: null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });

      await studentApi.create(formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Student registered successfully!');
      setFormData({ student_id: '', first_name: '', last_name: '', middle_name: '', address: '', email: '', gender: '', course: '', year: '', section: '', profile_image: null });
    } catch (error) {
      alert('Error registering student');
    }
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header text-white" style={{ backgroundColor: '#800000' }}>
          <img src="/GCC-LOGO.png" alt="GCC Logo" height="50" className="me-2" style={{ borderRadius: '50%' }} />
          <h3 className="d-inline-block mb-0">Student Registration</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-3">
                <div className="mb-3">
                  <label className="form-label">Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => setFormData({...formData, profile_image: e.target.files[0]})}
                  />
                </div>
              </div>
              <div className="col-md-9">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="First Name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Last Name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Middle Name"
                      value={formData.middle_name}
                      onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <select 
                    className="form-control"
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Course"
                      value={formData.course}
                      onChange={(e) => setFormData({...formData, course: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Year"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Section"
                      value={formData.section}
                      onChange={(e) => setFormData({...formData, section: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-end">
              <button type="submit" className="btn text-white" style={{ backgroundColor: '#800000' }}>Register</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default StudentForm;
