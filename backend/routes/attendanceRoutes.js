const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { CUTOFF_LABEL, isAfterCutoff } = require('../config/attendanceCutoff');

router.post('/checkin', (req, res) => {
    console.log('Received check-in request:', req.body);
    const studentId = `${req.body.student_id || ''}`.trim();
    const purpose = `${req.body.purpose || ''}`.trim();

    if (isAfterCutoff()) {
        return res.status(403).json({
            error: `Library attendance transactions close at ${CUTOFF_LABEL}. Active visitors are checked out automatically at the cutoff.`
        });
    }
    
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
        SELECT al.*, s.student_id, s.first_name, s.last_name, s.middle_name, s.course, s.year_level, s.section,
               s.email, s.gender, s.address, s.profile_image,
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

router.get('/tracker', (req, res) => {
    const period = `${req.query.period || 'today'}`.toLowerCase();
    const status = `${req.query.status || 'all'}`.toLowerCase();

    const allowedPeriods = new Set(['today', 'week', 'month', 'all']);
    const allowedStatuses = new Set(['all', 'pending', 'completed']);

    if (!allowedPeriods.has(period)) {
        return res.status(400).json({ error: 'Invalid period filter.' });
    }

    if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Invalid status filter.' });
    }

    const periodClauses = {
        today: 'DATE(COALESCE(al.check_out, al.check_in)) = CURDATE()',
        week: 'YEARWEEK(COALESCE(al.check_out, al.check_in), 1) = YEARWEEK(CURDATE(), 1)',
        month: 'YEAR(COALESCE(al.check_out, al.check_in)) = YEAR(CURDATE()) AND MONTH(COALESCE(al.check_out, al.check_in)) = MONTH(CURDATE())',
        all: '1 = 1'
    };

    const statusClauses = {
        all: '1 = 1',
        pending: 'al.check_out IS NULL',
        completed: 'al.check_out IS NOT NULL'
    };

    const whereClauses = [];

    if (periodClauses[period] !== '1 = 1') {
        whereClauses.push(periodClauses[period]);
    }

    if (statusClauses[status] !== '1 = 1') {
        whereClauses.push(statusClauses[status]);
    }

    const whereStatement = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const summaryQuery = `
        SELECT
            COUNT(CASE WHEN check_out IS NOT NULL AND DATE(check_out) = CURDATE() THEN 1 END) AS today_checked_out,
            COUNT(CASE WHEN check_out IS NOT NULL AND YEARWEEK(check_out, 1) = YEARWEEK(CURDATE(), 1) THEN 1 END) AS week_checked_out,
            COUNT(CASE WHEN check_out IS NOT NULL AND YEAR(check_out) = YEAR(CURDATE()) AND MONTH(check_out) = MONTH(CURDATE()) THEN 1 END) AS month_checked_out,
            COUNT(CASE WHEN check_out IS NULL THEN 1 END) AS pending_count,
            COUNT(CASE WHEN check_out IS NOT NULL THEN 1 END) AS completed_count
        FROM attendance_logs
    `;

    const recordsQuery = `
        SELECT
            al.id,
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
                WHEN al.check_out IS NULL THEN 'Pending'
                ELSE 'Completed'
            END AS status,
            CASE
                WHEN al.check_out IS NULL THEN TIMESTAMPDIFF(MINUTE, al.check_in, NOW())
                ELSE TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out)
            END AS duration_minutes
        FROM attendance_logs al
        JOIN students s ON al.student_id = s.id
        ${whereStatement}
        ORDER BY COALESCE(al.check_out, al.check_in) DESC
        LIMIT 200
    `;

    db.query(summaryQuery, (summaryErr, summaryResults) => {
        if (summaryErr) {
            return res.status(500).json({ error: summaryErr.message });
        }

        db.query(recordsQuery, (recordsErr, recordResults) => {
            if (recordsErr) {
                return res.status(500).json({ error: recordsErr.message });
            }

            res.json({
                filters: {
                    period,
                    status
                },
                summary: {
                    todayCheckedOut: summaryResults[0].today_checked_out || 0,
                    weekCheckedOut: summaryResults[0].week_checked_out || 0,
                    monthCheckedOut: summaryResults[0].month_checked_out || 0,
                    pendingCount: summaryResults[0].pending_count || 0,
                    completedCount: summaryResults[0].completed_count || 0
                },
                records: recordResults
            });
        });
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
