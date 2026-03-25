const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const { getSqlDateTimeInManila } = require('../config/manilaTime');
const {
  ensureLocalUploadDir,
  removeStoredProfileImage,
  storeUploadedProfileImage,
  usesCloudinaryStorage,
  usesLocalStorage
} = require('../config/storage');

const router = express.Router();

const runQuery = (query, values = []) =>
  new Promise((resolve, reject) => {
    db.query(query, values, (error, results) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(results);
    });
  });

const storage = usesLocalStorage()
  ? multer.diskStorage({
      destination(req, file, cb) {
        cb(null, ensureLocalUploadDir());
      },
      filename(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router.get('/test', (req, res) => {
  res.json({
    message: 'Student routes are working!',
    storage: usesCloudinaryStorage() ? 'cloudinary' : usesLocalStorage() ? 'local' : 'memory-only'
  });
});

router.get('/', async (req, res) => {
  try {
    const results = await runQuery('SELECT * FROM students');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile/:student_id', async (req, res) => {
  const studentId = req.params.student_id;
  console.log('Profile request for student ID:', studentId);

  try {
    const studentResults = await runQuery('SELECT * FROM students WHERE student_id = ?', [studentId]);

    if (studentResults.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const student = studentResults[0];
    const currentManilaTime = getSqlDateTimeInManila();
    const activitiesQuery = `
      SELECT
             al.id,
             al.purpose,
             DATE_FORMAT(al.check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
             DATE_FORMAT(al.check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
             CASE 
               WHEN al.check_out IS NULL THEN 'Currently Active'
               ELSE CONCAT('Checked out at ', DATE_FORMAT(al.check_out, '%Y-%m-%d %H:%i:%s'))
             END as status,
             GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, COALESCE(al.check_out, ?)), 0) as duration_minutes
      FROM attendance_logs al
      WHERE al.student_id = ?
      ORDER BY al.check_in DESC
      LIMIT 20
    `;
    const activitiesResults = await runQuery(activitiesQuery, [currentManilaTime, student.id]);
    const countResults = await runQuery(
      'SELECT COUNT(*) as total_visits FROM attendance_logs WHERE student_id = ?',
      [student.id]
    );

    res.json({
      student,
      activities: activitiesResults,
      total_visits: countResults[0].total_visits
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', async (req, res) => {
  const searchTerm = `${req.query.q || ''}`.trim();
  console.log('Searching for student:', searchTerm);

  if (!searchTerm) {
    res.status(400).json({ error: 'Search term is required' });
    return;
  }

  const likeTerm = `%${searchTerm}%`;
  const query = `
    SELECT * FROM students 
    WHERE student_id = ?
    OR student_id LIKE ?
    OR first_name LIKE ?
    OR last_name LIKE ?
    OR CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?
    ORDER BY last_name ASC, first_name ASC
    LIMIT 30
  `;

  try {
    const results = await runQuery(query, [searchTerm, likeTerm, likeTerm, likeTerm, likeTerm]);
    console.log('Search results:', results);
    res.json(results);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      error: 'Database error',
      details: error.message
    });
  }
});

router.post('/upload-image/:student_id', upload.single('profile_image'), async (req, res) => {
  const studentId = req.params.student_id;

  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  let imagePath = '';

  try {
    const studentResults = await runQuery('SELECT * FROM students WHERE student_id = ?', [studentId]);

    if (studentResults.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    imagePath = await storeUploadedProfileImage(req.file);
    await runQuery('UPDATE students SET profile_image = ? WHERE student_id = ?', [imagePath, studentId]);

    if (studentResults[0].profile_image) {
      await removeStoredProfileImage(studentResults[0].profile_image).catch((error) => {
        console.error('Unable to remove previous profile image:', error.message);
      });
    }

    res.json({
      message: 'Image uploaded successfully',
      imagePath
    });
  } catch (error) {
    if (imagePath) {
      await removeStoredProfileImage(imagePath).catch(() => {});
    }

    res.status(500).json({ error: error.message });
  }
});

router.get('/image/:filename', (req, res) => {
  if (!usesLocalStorage()) {
    res.status(404).json({ error: 'Local image route is disabled while cloud storage is active' });
    return;
  }

  const filename = req.params.filename;
  const imagePath = path.join(__dirname, '../uploads/profiles', filename);

  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
    return;
  }

  res.status(404).json({ error: 'Image not found' });
});

router.post('/', upload.single('profile_image'), async (req, res) => {
  const studentData = { ...req.body };
  let imagePath = '';

  try {
    if (req.file) {
      imagePath = await storeUploadedProfileImage(req.file);
      studentData.profile_image = imagePath;
    }

    const result = await runQuery('INSERT INTO students SET ?', studentData);
    res.status(201).json({ id: result.insertId, ...studentData });
  } catch (error) {
    if (imagePath) {
      await removeStoredProfileImage(imagePath).catch(() => {});
    }

    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Student ID already exists' });
      return;
    }

    res.status(500).json({ error: error.message });
  }
});

router.put('/:student_id', upload.single('profile_image'), async (req, res) => {
  const currentStudentId = req.params.student_id;
  let newImagePath = '';

  try {
    const studentResults = await runQuery('SELECT * FROM students WHERE student_id = ?', [currentStudentId]);

    if (studentResults.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const existingStudent = studentResults[0];
    const studentData = { ...req.body };

    if (req.file) {
      newImagePath = await storeUploadedProfileImage(req.file);
      studentData.profile_image = newImagePath;
    }

    const result = await runQuery('UPDATE students SET ? WHERE student_id = ?', [studentData, currentStudentId]);

    if (result.affectedRows === 0) {
      if (newImagePath) {
        await removeStoredProfileImage(newImagePath).catch(() => {});
      }

      res.status(404).json({ error: 'Student not found' });
      return;
    }

    if (newImagePath && existingStudent.profile_image) {
      await removeStoredProfileImage(existingStudent.profile_image).catch((error) => {
        console.error('Unable to remove previous profile image:', error.message);
      });
    }

    const nextStudentId = studentData.student_id || currentStudentId;
    const updatedResults = await runQuery('SELECT * FROM students WHERE student_id = ?', [nextStudentId]);

    res.json({
      message: 'Student updated successfully',
      student: updatedResults[0]
    });
  } catch (error) {
    if (newImagePath) {
      await removeStoredProfileImage(newImagePath).catch(() => {});
    }

    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Student ID already exists' });
      return;
    }

    res.status(500).json({ error: error.message });
  }
});

router.delete('/:student_id', async (req, res) => {
  const currentStudentId = req.params.student_id;

  try {
    const studentResults = await runQuery('SELECT * FROM students WHERE student_id = ?', [currentStudentId]);

    if (studentResults.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const existingStudent = studentResults[0];
    const result = await runQuery('DELETE FROM students WHERE student_id = ?', [currentStudentId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    if (existingStudent.profile_image) {
      await removeStoredProfileImage(existingStudent.profile_image).catch((error) => {
        console.error('Unable to remove deleted student image:', error.message);
      });
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
