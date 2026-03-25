import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildAssetUrl } from '../services/api';

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
};

const splitAdminName = (fullName) => {
  const parts = `${fullName || ''}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: '',
      middleName: '',
      lastName: ''
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: ''
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
};

const buildAdminName = (firstName, middleName, lastName) =>
  [firstName, middleName, lastName]
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .join(' ');

const getInitials = (firstName, lastName, fallbackName) => {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.trim();

  if (initials) {
    return initials.toUpperCase();
  }

  return `${fallbackName || 'A'}`
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || 'AD';
};

function AdminProfilePage() {
  const { employee, updateEmployeeProfile, uploadEmployeeProfileImage } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showProfileImage, setShowProfileImage] = useState(false);

  useEffect(() => {
    const nameParts = splitAdminName(employee?.name || '');

    setForm({
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      username: employee?.username || '',
      email: employee?.email || '',
      phone: employee?.phone || '',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    });
  }, [employee]);

  const photoInitials = useMemo(
    () => getInitials(form.firstName, form.lastName, employee?.name),
    [employee?.name, form.firstName, form.lastName]
  );
  const employeeProfileImageUrl = buildAssetUrl(employee?.profileImage);

  useEffect(() => {
    setShowProfileImage(Boolean(employeeProfileImageUrl));
  }, [employeeProfileImageUrl]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setErrorMessage('');
    setSuccessMessage('');
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const combinedName = buildAdminName(form.firstName, form.middleName, form.lastName);

    if (!combinedName) {
      setErrorMessage('Admin name is required.');
      return;
    }

    if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateEmployeeProfile({
        name: combinedName,
        username: form.username,
        title: employee?.title || 'Library employee access',
        email: form.email,
        phone: form.phone,
        info: employee?.info || '',
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });

      setSuccessMessage(response.message || 'Admin profile updated successfully.');
      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to update the admin profile right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileImageChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingImage(true);

    try {
      const response = await uploadEmployeeProfileImage(selectedFile);
      setSuccessMessage(response.message || 'Admin profile photo updated successfully.');
      setShowProfileImage(true);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to upload the admin profile photo right now.');
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  return (
    <div className="admin-profile-shell">
      <section className="admin-profile-card">
        <div className="admin-profile-header">
          <div className="admin-profile-header-copy">
            <h2>Admin Profile</h2>
            <p>You can change your first name, last name and phone number.</p>
          </div>

          <label className="admin-profile-photo-block" htmlFor="admin-profile-image">
            <span className="admin-profile-photo-circle">
              {showProfileImage ? (
                <img
                  src={employeeProfileImageUrl}
                  alt={employee?.name || 'Administrator'}
                  className="admin-profile-photo-image"
                  onError={() => setShowProfileImage(false)}
                />
              ) : (
                photoInitials
              )}
            </span>
            <span className="admin-profile-photo-caption">
              {isUploadingImage ? 'Uploading...' : showProfileImage ? 'Change Photo' : 'Insert Photo'}
            </span>
            <input
              id="admin-profile-image"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif"
              className="admin-profile-photo-input"
              onChange={handleProfileImageChange}
              disabled={isUploadingImage}
            />
          </label>
        </div>

        <form className="admin-profile-form" onSubmit={handleSubmit}>
          <div className="admin-profile-details-grid">
            <div className="admin-profile-field">
              <label className="form-label" htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>

            <div className="admin-profile-field">
              <label className="form-label" htmlFor="admin-first-name">First name</label>
              <input
                id="admin-first-name"
                name="firstName"
                className="form-control"
                value={form.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                required
              />
            </div>

            <div className="admin-profile-field">
              <label className="form-label" htmlFor="admin-last-name">Last name</label>
              <input
                id="admin-last-name"
                name="lastName"
                className="form-control"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
              />
            </div>

            <div className="admin-profile-field">
              <label className="form-label" htmlFor="admin-middle-name">Middle name</label>
              <input
                id="admin-middle-name"
                name="middleName"
                className="form-control"
                value={form.middleName}
                onChange={handleChange}
                placeholder="Enter middle name"
              />
            </div>

            <div className="admin-profile-field admin-profile-field-span">
              <label className="form-label" htmlFor="admin-phone">Phone number</label>
              <input
                id="admin-phone"
                name="phone"
                className="form-control"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <section className="admin-profile-credentials-card">
            <div className="admin-profile-credentials-copy">
              <h3>Password and Username</h3>
              <p>Update username and password here</p>
            </div>

            <div className="admin-profile-credentials-grid">
              <div className="admin-profile-field">
                <label className="form-label" htmlFor="admin-username">Username</label>
                <input
                  id="admin-username"
                  name="username"
                  className="form-control"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="admin-profile-field">
                <label className="form-label" htmlFor="admin-current-password">Enter Current Password</label>
                <input
                  id="admin-current-password"
                  name="currentPassword"
                  type="password"
                  className="form-control"
                  value={form.currentPassword}
                  onChange={handleChange}
                  placeholder="Required to save changes"
                  required
                />
              </div>

              <div className="admin-profile-field">
                <label className="form-label" htmlFor="admin-confirm-password">Confirm New Password</label>
                <input
                  id="admin-confirm-password"
                  name="confirmNewPassword"
                  type="password"
                  className="form-control"
                  value={form.confirmNewPassword}
                  onChange={handleChange}
                  placeholder="Retype new password"
                />
              </div>

              <div className="admin-profile-field">
                <label className="form-label" htmlFor="admin-new-password">Enter new password</label>
                <input
                  id="admin-new-password"
                  name="newPassword"
                  type="password"
                  className="form-control"
                  value={form.newPassword}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="alert alert-danger mb-0" role="alert">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success mb-0" role="status">
              {successMessage}
            </div>
          )}

          <div className="admin-profile-actions">
            <button type="submit" className="btn btn-maroon admin-profile-save-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save change'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AdminProfilePage;
