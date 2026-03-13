import React, { useEffect, useState } from 'react';
import { buildAssetUrl } from '../services/api';

const createFormState = (student) => ({
  student_id: student?.student_id || '',
  first_name: student?.first_name || '',
  last_name: student?.last_name || '',
  middle_name: student?.middle_name || '',
  address: student?.address || '',
  email: student?.email || '',
  gender: student?.gender || '',
  course: student?.course || '',
  year_level: student?.year_level || '',
  section: student?.section || '',
  profile_image: null
});

function StudentEditModal({ student, isSaving, onClose, onSave }) {
  const [formData, setFormData] = useState(createFormState(student));
  const [imagePreview, setImagePreview] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    setFormData(createFormState(student));
    setImagePreview(student?.profile_image ? buildAssetUrl(student.profile_image) : '');
    setSubmitMessage('');
  }, [student]);

  if (!student) {
    return null;
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFormData((current) => ({
      ...current,
      profile_image: file
    }));

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setImagePreview(loadEvent.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage('');

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'profile_image') {
        submitData.append(key, value ?? '');
      }
    });

    if (formData.profile_image) {
      submitData.append('profile_image', formData.profile_image);
    }

    try {
      await onSave(student.student_id, submitData);
    } catch (error) {
      setSubmitMessage(error.response?.data?.error || 'Unable to update this student right now.');
    }
  };

  const previewName = [formData.first_name, formData.last_name].filter(Boolean).join(' ').trim() || 'Student preview';

  return (
    <div className="student-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
      <div className="student-profile-modal student-edit-modal">
        <div className="student-profile-header">
          <div>
            <p className="profile-eyebrow">Student Record Update</p>
            <h3 id="edit-student-title" className="mb-1">Edit student details</h3>
            <p className="text-muted mb-0">Update the record and the directory will refresh automatically.</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body student-edit-form">
            {submitMessage && (
              <div className="alert alert-danger mb-4">
                {submitMessage}
              </div>
            )}

            <div className="row g-4">
              <div className="col-lg-4">
                <div className="profile-side-card student-edit-side-card">
                  <div className="profile-avatar-shell student-edit-avatar-shell">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt={previewName}
                        className="profile-avatar-image"
                      />
                    ) : (
                      <div className="profile-avatar-fallback">
                        <span>{formData.first_name?.[0] || 'S'}{formData.last_name?.[0] || 'T'}</span>
                      </div>
                    )}
                  </div>

                  <h4 className="mb-1">{previewName}</h4>
                  <p className="text-muted mb-4">{formData.student_id || 'Student ID pending'}</p>

                  <div className="profile-info-list">
                    <div>
                      <span className="profile-info-label">Profile image</span>
                      <strong>{formData.profile_image ? 'New image selected' : student.profile_image ? 'Keeping current image' : 'No image uploaded yet'}</strong>
                    </div>
                    <div>
                      <span className="profile-info-label">Current course</span>
                      <strong>{formData.course || 'Add course'}</strong>
                    </div>
                    <div>
                      <span className="profile-info-label">Year and section</span>
                      <strong>{formData.year_level ? `Year ${formData.year_level}` : 'No year'}{formData.section ? ` - ${formData.section}` : ''}</strong>
                    </div>
                  </div>

                  <div className="student-edit-upload mt-4">
                    <label htmlFor="student-edit-image" className="form-label">Replace profile photo</label>
                    <input
                      id="student-edit-image"
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <small className="text-muted">Leave this blank to keep the existing image.</small>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="profile-main-card">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Student ID</label>
                      <input
                        type="text"
                        name="student_id"
                        className="form-control"
                        required
                        pattern="[0-9]+"
                        value={formData.student_id}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email address</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label">First name</label>
                      <input
                        type="text"
                        name="first_name"
                        className="form-control"
                        required
                        value={formData.first_name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Last name</label>
                      <input
                        type="text"
                        name="last_name"
                        className="form-control"
                        required
                        value={formData.last_name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Middle name</label>
                      <input
                        type="text"
                        name="middle_name"
                        className="form-control"
                        value={formData.middle_name}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Gender</label>
                      <select
                        name="gender"
                        className="form-select"
                        required
                        value={formData.gender}
                        onChange={handleInputChange}
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Course</label>
                      <input
                        type="text"
                        name="course"
                        className="form-control"
                        list="student-course-options"
                        required
                        value={formData.course}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-2 mb-3">
                      <label className="form-label">Year</label>
                      <input
                        type="number"
                        name="year_level"
                        className="form-control"
                        required
                        min="1"
                        max="8"
                        value={formData.year_level}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-2 mb-3">
                      <label className="form-label">Section</label>
                      <input
                        type="text"
                        name="section"
                        className="form-control"
                        value={formData.section}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <textarea
                      name="address"
                      className="form-control"
                      rows="3"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>

                  <datalist id="student-course-options">
                    <option value="BPED" />
                    <option value="BECED" />
                    <option value="BCAED" />
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          <div className="student-edit-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-maroon" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StudentEditModal;
