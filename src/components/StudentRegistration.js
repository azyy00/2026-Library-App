import React, { useState } from 'react';
import { studentApi } from '../services/api';

function StudentRegistration() {
  const [formData, setFormData] = useState({
    id: 0,
    student_id: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    address: '',
    email: '',
    gender: '',
    course: '',
    year_level: '',
    section: '',
    profile_image: null,
  });
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create FormData for file upload
      const submitData = new FormData();
      
      // Add all form fields except profile_image
      Object.keys(formData).forEach(key => {
        if (key !== 'profile_image' && key !== 'id') {
          submitData.append(key, formData[key]);
        }
      });
      
      // Add profile image if selected
      if (formData.profile_image) {
        submitData.append('profile_image', formData.profile_image);
      }
      
      const response = await studentApi.create(submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Student registered successfully:', response.data);
      setMessage('Student registered successfully!');
      handleClear(); // Clear form after successful submission
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || 'Error registering student';
      setMessage(`Error: ${errorMessage}`);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({...formData, profile_image: file});
      setMessage('');
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = () => {
    setFormData({
      id: 0,
      student_id: '',
      first_name: '',
      last_name: '',
      middle_name: '',
      address: '',
      email: '',
      gender: '',
      course: '',
      year_level: '',
      section: '',
      profile_image: null,
    });
    setImagePreview(null);
    setMessage('');
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header text-white" style={{ backgroundColor: '#800000' }}>
          <div className="d-flex align-items-center">
            <img src="/GCC-LOGO.png" alt="GCC Logo" height="40" className="me-2" style={{ borderRadius: '50%' }} />
            <div>
              <h3 className="mb-0">Student Registration Form</h3>
              <small className="opacity-75">Create student records before check-in begins.</small>
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Student ID Field */}
              <div className="col-md-12 mb-3">
                <label className="form-label">Student ID</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  pattern="[0-9]+"
                  placeholder="Enter Student ID Number"
                  value={formData.student_id}
                  onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                />
              </div>
            </div>

            <div className="row">
              {/* Name Fields */}
              <div className="col-md-4 mb-3">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Enter First Name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Enter Last Name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Middle Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Middle Name"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-8 mb-3">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  required
                  placeholder="Enter Complete Address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Gender</label>
                <select 
                  className="form-select"
                  required
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter school or personal email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Profile Picture</label>
                <div className="d-flex gap-3 align-items-center">
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="text-center">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="rounded-circle"
                        style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                      />
                      <small className="d-block text-muted">Preview</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Course</label>
                <select 
                  className="form-select"
                  required
                  value={formData.course}
                  onChange={(e) => setFormData({...formData, course: e.target.value})}
                >
                  <option value="">Select Course</option>
                  <option value="BPED">BPED</option>
                  <option value="BECED">BECED</option>
                  <option value="BCAED">BCAED</option>
                </select>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Year Level</label>
                <input
                  type="number"
                  className="form-control"
                  required
                  min="1"
                  max="8"
                  placeholder="Enter Year Level"
                  value={formData.year_level}
                  onChange={(e) => setFormData({...formData, year_level: e.target.value})}
                />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Section</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Enter Section"
                  value={formData.section}
                  onChange={(e) => setFormData({...formData, section: e.target.value})}
                />
              </div>
            </div>

            {message && (
              <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'} mt-3`}>
                {message}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" onClick={handleClear} className="btn btn-danger">
                Clear Form
              </button>
              <button type="submit" className="btn text-white" style={{ backgroundColor: '#800000' }}>
                Register Student
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default StudentRegistration;
