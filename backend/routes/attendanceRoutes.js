const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/checkin', (req, res) => {
    console.log('Received check-in request:', req.body);
    const studentId = `${req.body.student_id || ''}`.trim();
    const purpose = `${req.body.purpose || ''}`.trim();
    
    if (!studentId || !purpose) {
        return res.status(400).json({ error: 'Student ID and purpose are required' });
    }

    // First get student's database ID
    db.query(
        'SELECT * FROM students WHERE student_id = ?', 
        [studentId], 
        (err, results) => {
            if (err) {
                console.error('Database error finding student:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: 'Student not found' });
            }

            const student = results[0];
            console.log('Found student:', student);

            db.query(
                `SELECT id, check_in
                 FROM attendance_logs
                 WHERE student_id = ? AND check_out IS NULL
                 ORDER BY check_in DESC
                 LIMIT 1`,
                [student.id],
                (activeErr, activeResults) => {
                    if (activeErr) {
                        console.error('Database error checking active attendance:', activeErr);
                        return res.status(500).json({ error: 'Could not validate current attendance state' });
                    }

                    if (activeResults.length > 0) {
                        return res.status(409).json({
                            error: 'Student is already checked in',
                            activeAttendance: activeResults[0],
                            student_name: `${student.first_name} ${student.last_name}`
                        });
                    }

                    // Create attendance record
                    const attendance = {
                        student_id: student.id,
                        purpose: purpose,
                        check_in: new Date()
                    };

                    db.query('INSERT INTO attendance_logs SET ?', attendance, (insertErr, result) => {
                        if (insertErr) {
                            console.error('Database error creating attendance:', insertErr);
                            return res.status(500).json({ error: 'Could not create attendance record' });
                        }
                        
                        console.log('Created attendance record:', { id: result.insertId, ...attendance });
                        res.status(201).json({
                            id: result.insertId,
                            student_name: `${student.first_name} ${student.last_name}`,
                            ...attendance
                        });
                    });
                }
            );
        }
    );
});

// Get active attendance records
router.get('/active', (req, res) => {
    const query = `
        SELECT al.*, s.student_id, s.first_name, s.last_name, s.course, s.year_level, s.section,
               TIMESTAMPDIFF(MINUTE, al.check_in, NOW()) as minutes_inside
        FROM attendance_logs al
        JOIN students s ON al.student_id = s.id
        WHERE al.check_out IS NULL
        ORDER BY al.check_in DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

router.post('/checkout/:id', (req, res) => {
    db.query('UPDATE attendance_logs SET check_out = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id],
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(404).json({ error: 'Attendance record not found' });
                return;
            }

            res.json({ message: 'Check-out successful' });
        }
    );
});

// Export student activities data
router.get('/export', (req, res) => {
    const query = `
        SELECT 
            s.student_id,
            s.first_name,
            s.last_name,
            s.course,
            s.year_level,
            s.section,
            al.purpose,
            al.check_in,
            al.check_out,
            CASE 
                WHEN al.check_out IS NULL THEN 'Active'
                ELSE 'Completed'
            END as status,
            CASE 
                WHEN al.check_out IS NOT NULL THEN 
                    TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out)
                ELSE NULL
            END as duration_minutes
        FROM attendance_logs al
        JOIN students s ON al.student_id = s.id
        ORDER BY al.check_in DESC
    `;
    
    db.query(query, (err, activities) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Get statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as totalVisits,
                COUNT(CASE WHEN check_out IS NULL THEN 1 END) as activeVisitors
            FROM attendance_logs
        `;
        
        db.query(statsQuery, (statsErr, stats) => {
            if (statsErr) {
                res.status(500).json({ error: statsErr.message });
                return;
            }

            res.json({
                activities: activities,
                totalVisits: stats[0].totalVisits,
                activeVisitors: stats[0].activeVisitors
            });
        });
    });
});

module.exports = router;
