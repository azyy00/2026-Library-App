require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const { autoCheckoutExpiredSessions, startAttendanceCutoffScheduler } = require('./config/attendanceCutoff');
const { requireEmployeeAuth } = require('./config/auth');
const { getStorageMode, isVercelRuntime, usesLocalStorage } = require('./config/storage');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const statsRoutes = require('./routes/statsRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const allowedOrigins = `${process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || ''}`
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const storageMode = getStorageMode();

const parseOrigin = (origin) => {
  try {
    return new URL(origin);
  } catch (error) {
    return null;
  }
};

const isAllowedOrigin = (origin) => {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  const incomingOrigin = parseOrigin(origin);

  if (!incomingOrigin) {
    return false;
  }

  return allowedOrigins.some((configuredOrigin) => {
    const parsedConfiguredOrigin = parseOrigin(configuredOrigin);

    if (!parsedConfiguredOrigin || parsedConfiguredOrigin.protocol !== incomingOrigin.protocol) {
      return false;
    }

    if (parsedConfiguredOrigin.hostname === incomingOrigin.hostname) {
      return true;
    }

    if (
      parsedConfiguredOrigin.hostname.endsWith('.vercel.app')
      && incomingOrigin.hostname.endsWith('.vercel.app')
    ) {
      const configuredPrefix = parsedConfiguredOrigin.hostname.replace(/\.vercel\.app$/, '');

      return incomingOrigin.hostname.startsWith(`${configuredPrefix}-`);
    }

    return false;
  });
};

if (`${process.env.FILE_STORAGE || ''}`.trim().toLowerCase() === 'cloudinary' && storageMode !== 'cloudinary') {
  console.warn('FILE_STORAGE is set to cloudinary, but Cloudinary credentials are incomplete. Falling back to local storage.');
}

if (isVercelRuntime() && storageMode === 'local') {
  console.warn('Local file storage is not persistent on Vercel. Configure Cloudinary to enable profile image uploads in production.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || isAllowedOrigin(origin)) {
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
app.use('/api/auth', authRoutes);
app.use('/api/students', requireEmployeeAuth, studentRoutes);
app.use('/api/attendance', requireEmployeeAuth, attendanceRoutes);
app.use('/api/stats', requireEmployeeAuth, statsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

if (require.main === module) {
  const PORT = Number(process.env.PORT || 3001);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} using ${storageMode} file storage`);
  });

  if (!isVercelRuntime()) {
    startAttendanceCutoffScheduler();
  }
}

module.exports = app;
