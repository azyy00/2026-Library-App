import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentApi } from '../services/api';

const DEFAULT_FORM_STATE = {
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
  profile_image: null
};

const resetFormState = () => ({
  ...DEFAULT_FORM_STATE
});

function MonitoringRegistrationPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(resetFormState);
  const [imagePreview, setImagePreview] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value
    }));
    setMessage(null);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    handleFieldChange('profile_image', file);

    if (!file) {
      setImagePreview('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setImagePreview(loadEvent.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setFormData(resetFormState());
    setImagePreview('');
    setMessage(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const submitData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          submitData.append(key, value);
        }
      });

      await studentApi.create(submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setFormData(resetFormState());
      setImagePreview('');
      setMessage({
        type: 'success',
        text: 'Student registered successfully. You can return to monitoring now.'
      });
    } catch (error) {
      console.error('Monitoring registration error:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.error || 'Unable to register this student right now.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="monitoring-register-shell">
      <div className="monitoring-register-card">
        <header className="monitoring-register-header">
          <div className="monitoring-register-brand">
            <img src="/GCC-LOGO.png" alt="Goa Community College logo" className="monitoring-register-logo" />
            <div>
              <span className="monitoring-register-kicker">Goa Community College</span>
              <h1>Student Registration</h1>
              <p>Use this page only when a student is not yet in the library record.</p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-maroon"
            onClick={() => navigate('/monitoring')}
          >
            Back to Monitoring
          </button>
        </header>

        {message && (
          <div className={`alert alert-${message.type} monitoring-register-alert`} role="alert">
            {message.text}
          </div>
        )}

        <form className="monitoring-register-form" onSubmit={handleSubmit}>
          <div className="monitoring-register-grid">
            <div className="monitoring-register-field monitoring-register-span-full">
              <label htmlFor="monitoring-register-student-id">Student ID</label>
              <input
                id="monitoring-register-student-id"
                type="text"
                className="form-control"
                value={formData.student_id}
                onChange={(event) => handleFieldChange('student_id', event.target.value)}
                placeholder="Enter student ID"
                required
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-first-name">First Name</label>
              <input
                id="monitoring-register-first-name"
                type="text"
                className="form-control"
                value={formData.first_name}
                onChange={(event) => handleFieldChange('first_name', event.target.value)}
                placeholder="First name"
                required
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-last-name">Last Name</label>
              <input
                id="monitoring-register-last-name"
                type="text"
                className="form-control"
                value={formData.last_name}
                onChange={(event) => handleFieldChange('last_name', event.target.value)}
                placeholder="Last name"
                required
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-middle-name">Middle Name</label>
              <input
                id="monitoring-register-middle-name"
                type="text"
                className="form-control"
                value={formData.middle_name}
                onChange={(event) => handleFieldChange('middle_name', event.target.value)}
                placeholder="Middle name"
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-gender">Gender</label>
              <select
                id="monitoring-register-gender"
                className="form-select"
                value={formData.gender}
                onChange={(event) => handleFieldChange('gender', event.target.value)}
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="monitoring-register-field monitoring-register-span-full">
              <label htmlFor="monitoring-register-address">Address</label>
              <textarea
                id="monitoring-register-address"
                className="form-control"
                rows="3"
                value={formData.address}
                onChange={(event) => handleFieldChange('address', event.target.value)}
                placeholder="Complete address"
                required
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-email">Email</label>
              <input
                id="monitoring-register-email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                placeholder="Email address"
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-course">Course</label>
              <select
                id="monitoring-register-course"
                className="form-select"
                value={formData.course}
                onChange={(event) => handleFieldChange('course', event.target.value)}
                required
              >
                <option value="">Select course</option>
                <option value="BPED">BPED</option>
                <option value="BECED">BECED</option>
                <option value="BCAED">BCAED</option>
              </select>
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-year-level">Year Level</label>
              <input
                id="monitoring-register-year-level"
                type="number"
                className="form-control"
                min="1"
                max="8"
                value={formData.year_level}
                onChange={(event) => handleFieldChange('year_level', event.target.value)}
                placeholder="Year level"
                required
              />
            </div>

            <div className="monitoring-register-field">
              <label htmlFor="monitoring-register-section">Section</label>
              <input
                id="monitoring-register-section"
                type="text"
                className="form-control"
                value={formData.section}
                onChange={(event) => handleFieldChange('section', event.target.value)}
                placeholder="Section"
                required
              />
            </div>

            <div className="monitoring-register-field monitoring-register-span-full">
              <label htmlFor="monitoring-register-image">Profile Image</label>
              <div className="monitoring-register-upload">
                <input
                  id="monitoring-register-image"
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview ? (
                  <img src={imagePreview} alt="Student preview" className="monitoring-register-preview" />
                ) : (
                  <div className="monitoring-register-preview monitoring-register-preview-empty">No image selected</div>
                )}
              </div>
            </div>
          </div>

          <div className="monitoring-register-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={handleClear} disabled={isSubmitting}>
              Clear
            </button>
            <button type="submit" className="btn btn-maroon" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MonitoringRegistrationPage;
