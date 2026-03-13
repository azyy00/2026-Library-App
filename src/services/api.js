import axios from 'axios';

const configuredApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const apiBaseUrl = configuredApiUrl.replace(/\/+$/, '');
export const backendBaseUrl = apiBaseUrl.replace(/\/api$/, '');

const api = axios.create({
  baseURL: apiBaseUrl
});

export const buildAssetUrl = (assetPath) => {
  if (!assetPath) {
    return '';
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  return `${backendBaseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
};

export const studentApi = {
  getAll: () => api.get('/students'),
  create: (data, config = {}) => api.post('/students', data, config),
  search: (query) => api.get('/students/search', { params: { q: query } }),
  getProfile: (studentId) => api.get(`/students/profile/${studentId}`)
};

export const attendanceApi = {
  checkIn: (data) => api.post('/attendance/checkin', data),
  getActive: () => api.get('/attendance/active'),
  exportReport: () => api.get('/attendance/export'),
  checkOut: (id) => api.post(`/attendance/checkout/${id}`)
};

export const statsApi = {
  getOverview: () => api.get('/stats')
};

export default api;
