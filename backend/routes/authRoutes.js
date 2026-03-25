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
  const result = await authenticateEmployee(req.body?.username, req.body?.password);

  if (!result.ok) {
    res.status(result.status).json({ error: result.message });
    return;
  }

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
