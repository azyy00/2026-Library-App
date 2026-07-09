const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  authenticateEmployee,
  createAuthToken,
  getEmployeeProfile,
  requireEmployeeAuth,
  updateEmployeeProfile,
  updateEmployeeProfileImage
} = require('../config/auth');
const {
  ensureLocalUploadDir,
  removeStoredProfileImage,
  storeUploadedProfileImage,
  usesLocalStorage
} = require('../config/storage');

const router = express.Router();

// --- Login rate limiting -------------------------------------------------
// Throttles repeated failed logins per client + username to resist
// brute-force. In-memory per instance: on serverless this resets per cold
// start, but still meaningfully limits sustained guessing on a warm instance.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_ATTEMPTS_MAX_KEYS = 5000;
const loginAttempts = new Map();

const getLoginKey = (req) => {
  const forwarded = `${req.headers['x-forwarded-for'] || ''}`.split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  const username = `${req.body?.username || ''}`.trim().toLowerCase();
  return `${ip}|${username}`;
};

const isLoginRateLimited = (key) => {
  const entry = loginAttempts.get(key);

  if (!entry) {
    return false;
  }

  if (Date.now() - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }

  return entry.count >= LOGIN_MAX_ATTEMPTS;
};

const recordLoginFailure = (key) => {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    // Guard against unbounded growth from spoofed keys.
    if (loginAttempts.size >= LOGIN_ATTEMPTS_MAX_KEYS) {
      loginAttempts.clear();
    }

    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }

  entry.count += 1;
};

const clearLoginFailures = (key) => {
  loginAttempts.delete(key);
};

const storage = usesLocalStorage()
  ? multer.diskStorage({
      destination(req, file, cb) {
        cb(null, ensureLocalUploadDir());
      },
      filename(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `employee-profile-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    })
  : multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
      return;
    }

    cb(new Error('Only image files are allowed!'));
  }
});

router.post('/login', async (req, res) => {
  const loginKey = getLoginKey(req);

  if (isLoginRateLimited(loginKey)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait a few minutes and try again.' });
    return;
  }

  const result = await authenticateEmployee(req.body?.username, req.body?.password);

  if (!result.ok) {
    // Only count credential failures toward the limit, not validation errors.
    if (result.status === 401) {
      recordLoginFailure(loginKey);
    }

    res.status(result.status).json({ error: result.message });
    return;
  }

  clearLoginFailures(loginKey);

  res.json({
    token: createAuthToken(result.employee),
    employee: result.employee
  });
});

router.get('/session', requireEmployeeAuth, async (req, res, next) => {
  try {
    const employee = await getEmployeeProfile(req.employee);

    res.json({
      employee
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', requireEmployeeAuth, async (req, res, next) => {
  try {
    const employee = await getEmployeeProfile(req.employee);

    res.json({
      employee
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', requireEmployeeAuth, async (req, res, next) => {
  try {
    const result = await updateEmployeeProfile(req.employee, req.body);

    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }

    res.json({
      message: 'Admin profile updated successfully.',
      token: createAuthToken(result.employee),
      employee: result.employee
    });
  } catch (error) {
    next(error);
  }
});

router.post('/profile-image', requireEmployeeAuth, upload.single('profile_image'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  let imagePath = '';

  try {
    imagePath = await storeUploadedProfileImage(req.file);
    const result = await updateEmployeeProfileImage(req.employee, imagePath);

    if (!result.ok) {
      if (imagePath) {
        await removeStoredProfileImage(imagePath).catch(() => {});
      }

      res.status(result.status).json({ error: result.message });
      return;
    }

    if (result.previousProfileImage && result.previousProfileImage !== imagePath) {
      await removeStoredProfileImage(result.previousProfileImage).catch((error) => {
        console.error('Unable to remove previous admin profile image:', error.message);
      });
    }

    res.json({
      message: 'Admin profile photo updated successfully.',
      employee: result.employee
    });
  } catch (error) {
    if (imagePath) {
      await removeStoredProfileImage(imagePath).catch(() => {});
    }

    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.json({
    message: 'Logged out successfully.'
  });
});

module.exports = router;
