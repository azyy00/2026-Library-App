require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const { autoCheckoutExpiredSessions, startAttendanceCutoffScheduler } = require('./config/attendanceCutoff');
const { getStorageMode, usesLocalStorage } = require('./config/storage');
const attendanceRoutes = require('./routes/attendanceRoutes');
const statsRoutes = require('./routes/statsRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const allowedOrigins = `${process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || ''}`
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const storageMode = getStorageMode();

if (`${process.env.FILE_STORAGE || ''}`.trim().toLowerCase() === 'cloudinary' && storageMode !== 'cloudinary') {
  console.warn('FILE_STORAGE is set to cloudinary, but Cloudinary credentials are incomplete. Falling back to local storage.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  }
}));
app.use(express.json());

if (usesLocalStorage()) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Apply the daily cutoff before handling API requests so stale open visits close automatically.
app.use('/api', async (req, res, next) => {
  try {
    await autoCheckoutExpiredSessions();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/stats', statsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} using ${storageMode} file storage`);
});

startAttendanceCutoffScheduler();
