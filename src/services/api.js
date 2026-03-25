import axios from 'axios';

const configuredApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const apiBaseUrl = configuredApiUrl.replace(/\/+$/, '');
export const backendBaseUrl = apiBaseUrl.replace(/\/api$/, '');
const authTokenStorageKey = 'gcc_library_employee_token';

export const getStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(authTokenStorageKey) || '';
};

export const setStoredAuthToken = (token) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(authTokenStorageKey, token);
};

export const clearStoredAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(authTokenStorageKey);
};

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthHandling) {
      clearStoredAuthToken();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('library-auth-state-change'));
      }
    }

    return Promise.reject(error);
  }
);

export const buildAssetUrl = (assetPath) => {
  if (!assetPath) {
    return '';
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  return `${backendBaseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
};

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials, { skipAuthHandling: true }),
  getSession: () => api.get('/auth/session', { skipAuthHandling: true }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (payload) => api.put('/auth/profile', payload),
  uploadProfileImage: (formData) => api.post('/auth/profile-image', formData),
  logout: () => api.post('/auth/logout', {}, { skipAuthHandling: true })
};

export const studentApi = {
  getAll: () => api.get('/students'),
  create: (data, config = {}) => api.post('/students', data, config),
  search: (query) => api.get('/students/search', { params: { q: query } }),
  getProfile: (studentId) => api.get(`/students/profile/${studentId}`),
  update: (studentId, data, config = {}) => api.put(`/students/${studentId}`, data, config),
  remove: (studentId) => api.delete(`/students/${studentId}`)
};

export const attendanceApi = {
  checkIn: (data) => api.post('/attendance/checkin', data),
  getActive: () => api.get('/attendance/active'),
  getTracker: (params = {}) => api.get('/attendance/tracker', { params }),
  exportReport: () => api.get('/attendance/export'),
  checkOut: (id) => api.post(`/attendance/checkout/${id}`)
};

export const monitoringApi = {
  getSummary: () => api.get('/attendance/kiosk/summary'),
  lookupStudent: (studentId) => api.get(`/attendance/kiosk/student/${encodeURIComponent(studentId)}`),
  checkIn: (studentId, purpose) => api.post('/attendance/kiosk/check-in', { student_id: studentId, purpose }),
  checkOut: (studentId) => api.post('/attendance/kiosk/check-out', { student_id: studentId }),
  scanId: (studentId, purpose) => api.post('/attendance/kiosk/scan', { student_id: studentId, purpose })
};

export const statsApi = {
  getOverview: () => api.get('/stats')
};

export default api;
