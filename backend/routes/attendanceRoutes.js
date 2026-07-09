const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { CUTOFF_LABEL, isAfterCutoff } = require('../config/attendanceCutoff');
const { ensureAttendanceAuditColumns } = require('../config/attendanceSchema');
const {
    getEndOfMonthDateInManila,
    getEndOfWeekDateInManila,
    getSqlDateInManila,
    getSqlDateTimeInManila,
    getStartOfMonthDateInManila,
    getStartOfWeekDateInManila
} = require('../config/manilaTime');
const dbPromise = db.promise();
const MONITORING_HOURS = Array.from({ length: 12 }, (_, index) => index + 6);

// The employee performing each action is recorded for audit purposes.
// requireEmployeeAuth runs ahead of this router, so req.employee is always set.
const getActor = (req) => `${req.employee?.username || ''}`.trim() || null;

// Make sure the audit columns exist before any attendance query runs.
router.use(async (req, res, next) => {
    try {
        await ensureAttendanceAuditColumns();
        next();
    } catch (error) {
        next(error);
    }
});

const createHttpError = (status, message, extra = {}) => {
    const error = new Error(message);
    error.status = status;
    Object.assign(error, extra);
    return error;
};

const formatHourLabel = (hour) => {
    const normalizedHour = Number(hour);
    const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
    const displayHour = normalizedHour % 12 || 12;

    return `${displayHour}:00 ${suffix}`;
};

const getMonitoringSummary = async () => {
    const todayDate = getSqlDateInManila();
    const [summaryRows] = await dbPromise.query(`
        SELECT
            COUNT(CASE WHEN DATE(check_in) = ? THEN 1 END) AS today_visits,
            COUNT(CASE WHEN check_out IS NULL THEN 1 END) AS active_visitors,
            COUNT(CASE WHEN check_out IS NOT NULL AND DATE(check_out) = ? THEN 1 END) AS checked_out_today
        FROM attendance_logs
    `, [todayDate, todayDate]);
    const [hourlyRows] = await dbPromise.query(`
        SELECT HOUR(check_in) AS hour_slot, COUNT(*) AS total
        FROM attendance_logs
        WHERE DATE(check_in) = ?
        GROUP BY HOUR(check_in)
        ORDER BY HOUR(check_in)
    `, [todayDate]);
    const [recentRows] = await dbPromise.query(`
        SELECT
            al.id,
            s.student_id,
            s.first_name,
            s.last_name,
            s.course,
            s.year_level,
            s.section,
            s.profile_image,
            al.purpose,
            DATE_FORMAT(al.check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(al.check_out, '%Y-%m-%d %H:%i:%s') AS check_out
        FROM attendance_logs al
        JOIN students s ON s.id = al.student_id
        WHERE DATE(al.check_in) = ? OR DATE(al.check_out) = ?
        ORDER BY COALESCE(al.check_out, al.check_in) DESC
        LIMIT 8
    `, [todayDate, todayDate]);

    const hourlyMap = new Map(
        hourlyRows.map((row) => [Number(row.hour_slot), Number(row.total) || 0])
    );

    return {
        summary: {
            todayVisits: summaryRows[0]?.today_visits || 0,
            activeVisitors: summaryRows[0]?.active_visitors || 0,
            checkedOutToday: summaryRows[0]?.checked_out_today || 0
        },
        hourly: MONITORING_HOURS.map((hour) => ({
            hour,
            label: formatHourLabel(hour),
            total: hourlyMap.get(hour) || 0
        })),
        recent: recentRows.map((row) => ({
            ...row,
            status: row.check_out ? 'Checked Out' : 'Checked In'
        })),
        cutoffLabel: CUTOFF_LABEL,
        serverTime: new Date().toISOString()
    };
};

const getKioskStudentByExternalId = async (studentId) => {
    const [studentRows] = await dbPromise.query(
        `SELECT id, student_id, first_name, last_name, course, year_level, section, email, profile_image
         FROM students
         WHERE student_id = ?
         LIMIT 1`,
        [studentId]
    );

    return studentRows[0] || null;
};

const getLockedStudentByExternalId = async (connection, studentId) => {
    const [studentRows] = await connection.query(
        `SELECT id, student_id, first_name, last_name, course, year_level, section, email, profile_image
         FROM students
         WHERE student_id = ?
         LIMIT 1
         FOR UPDATE`,
        [studentId]
    );

    return studentRows[0] || null;
};

const getKioskActiveAttendance = async (studentDbId) => {
    const [attendanceRows] = await dbPromise.query(
        `SELECT
            id,
            DATE_FORMAT(check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            purpose
         FROM attendance_logs
         WHERE student_id = ? AND check_out IS NULL
         ORDER BY check_in DESC
         LIMIT 1`,
        [studentDbId]
    );

    return attendanceRows[0] || null;
};

const getLockedActiveAttendance = async (connection, studentDbId) => {
    const [attendanceRows] = await connection.query(
        `SELECT
            id,
            DATE_FORMAT(check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            purpose
         FROM attendance_logs
         WHERE student_id = ? AND check_out IS NULL
         ORDER BY check_in DESC
         LIMIT 1
         FOR UPDATE`,
        [studentDbId]
    );

    return attendanceRows[0] || null;
};

const getKioskLatestAttendance = async (studentDbId) => {
    const [attendanceRows] = await dbPromise.query(
        `SELECT
            id,
            DATE_FORMAT(check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            purpose
         FROM attendance_logs
         WHERE student_id = ?
         ORDER BY COALESCE(check_out, check_in) DESC
         LIMIT 1`,
        [studentDbId]
    );

    return attendanceRows[0] || null;
};

const createLockedCheckIn = async (connection, student, purpose, actor = null) => {
    const checkInTime = getSqlDateTimeInManila();
    const [insertResult] = await connection.query(
        'INSERT INTO attendance_logs (student_id, purpose, check_in, checked_in_by) VALUES (?, ?, ?, ?)',
        [student.id, purpose, checkInTime, actor]
    );
    const [attendanceRows] = await connection.query(
        `SELECT
            id,
            DATE_FORMAT(check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            purpose
         FROM attendance_logs
         WHERE id = ?
         LIMIT 1`,
        [insertResult.insertId]
    );

    return attendanceRows[0];
};

const completeLockedCheckOut = async (connection, attendanceId, actor = null) => {
    const checkoutTime = getSqlDateTimeInManila();
    await connection.query(
        'UPDATE attendance_logs SET check_out = ?, checked_out_by = ? WHERE id = ?',
        [checkoutTime, actor, attendanceId]
    );

    const [attendanceRows] = await connection.query(
        `SELECT
            id,
            DATE_FORMAT(check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            purpose
         FROM attendance_logs
         WHERE id = ?
         LIMIT 1`,
        [attendanceId]
    );

    return attendanceRows[0];
};

const runStudentAttendanceTransaction = async (studentId, work) => {
    const connection = await dbPromise.getConnection();

    try {
        await connection.beginTransaction();
        const student = await getLockedStudentByExternalId(connection, studentId);

        if (!student) {
            throw createHttpError(404, 'Student ID not found.');
        }

        const result = await work(connection, student);
        await connection.commit();

        return {
            student,
            ...result
        };
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('Attendance transaction rollback error:', rollbackError);
        }

        throw error;
    } finally {
        connection.release();
    }
};

router.get('/kiosk/summary', async (req, res) => {
    try {
        const summary = await getMonitoringSummary();
        res.json(summary);
    } catch (error) {
        console.error('Monitoring summary error:', error);
        res.status(500).json({ error: 'Unable to load attendance monitoring summary.' });
    }
});

router.get('/kiosk/student/:studentId', async (req, res) => {
    const studentId = `${req.params.studentId || ''}`.trim();

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required.' });
    }

    try {
        const student = await getKioskStudentByExternalId(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student ID not found.' });
        }

        const activeAttendance = await getKioskActiveAttendance(student.id);
        const latestAttendance = activeAttendance || await getKioskLatestAttendance(student.id);

        return res.json({
            student,
            activeAttendance,
            latestAttendance,
            isCheckedIn: Boolean(activeAttendance)
        });
    } catch (error) {
        console.error('Monitoring student lookup error:', error);
        return res.status(500).json({ error: 'Unable to load that student right now.' });
    }
});

router.post('/kiosk/check-in', async (req, res) => {
    const studentId = `${req.body.student_id || ''}`.trim();
    const purpose = `${req.body.purpose || ''}`.trim();

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required.' });
    }

    if (!purpose) {
        return res.status(400).json({ error: 'Select the visit purpose before checking in.' });
    }

    const actor = getActor(req);

    try {
        const { student, attendance } = await runStudentAttendanceTransaction(studentId, async (connection, lockedStudent) => {
            const activeAttendance = await getLockedActiveAttendance(connection, lockedStudent.id);

            if (activeAttendance) {
                throw createHttpError(409, 'Student is already checked in.');
            }

            if (isAfterCutoff()) {
                throw createHttpError(
                    403,
                    `Library attendance transactions close at ${CUTOFF_LABEL}. Active visitors are checked out automatically at the cutoff.`
                );
            }

            return {
                attendance: await createLockedCheckIn(connection, lockedStudent, purpose, actor)
            };
        });

        return res.status(201).json({
            action: 'check_in',
            message: `${student.first_name} ${student.last_name} checked in successfully.`,
            student,
            attendance
        });
    } catch (error) {
        console.error('Monitoring check-in error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Unable to process check-in right now.' });
    }
});

router.post('/kiosk/check-out', async (req, res) => {
    const studentId = `${req.body.student_id || ''}`.trim();

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required.' });
    }

    const actor = getActor(req);

    try {
        const { student, attendance } = await runStudentAttendanceTransaction(studentId, async (connection, lockedStudent) => {
            const activeAttendance = await getLockedActiveAttendance(connection, lockedStudent.id);

            if (!activeAttendance) {
                throw createHttpError(409, 'Student is not currently checked in.');
            }

            return {
                attendance: await completeLockedCheckOut(connection, activeAttendance.id, actor)
            };
        });

        return res.json({
            action: 'check_out',
            message: `${student.first_name} ${student.last_name} checked out successfully.`,
            student,
            attendance
        });
    } catch (error) {
        console.error('Monitoring check-out error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Unable to process check-out right now.' });
    }
});

router.post('/kiosk/scan', async (req, res) => {
    const studentId = `${req.body.student_id || ''}`.trim();
    const purpose = `${req.body.purpose || ''}`.trim();

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required.' });
    }

    const actor = getActor(req);

    try {
        const result = await runStudentAttendanceTransaction(studentId, async (connection, lockedStudent) => {
            const activeAttendance = await getLockedActiveAttendance(connection, lockedStudent.id);

            if (activeAttendance) {
                return {
                    action: 'check_out',
                    attendance: await completeLockedCheckOut(connection, activeAttendance.id, actor)
                };
            }

            if (isAfterCutoff()) {
                throw createHttpError(
                    403,
                    `Library attendance transactions close at ${CUTOFF_LABEL}. Active visitors are checked out automatically at the cutoff.`
                );
            }

            if (!purpose) {
                throw createHttpError(400, 'Select the visit purpose before submitting the student ID.');
            }

            return {
                action: 'check_in',
                attendance: await createLockedCheckIn(connection, lockedStudent, purpose, actor)
            };
        });

        return res.status(result.action === 'check_in' ? 201 : 200).json({
            action: result.action,
            message: `${result.student.first_name} ${result.student.last_name} ${result.action === 'check_in' ? 'checked in' : 'checked out'} successfully.`,
            student: result.student,
            attendance: result.attendance
        });
    } catch (error) {
        console.error('Monitoring scan error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Unable to process the attendance scan right now.' });
    }
});

router.post('/checkin', async (req, res) => {
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

    const actor = getActor(req);

    try {
        const { student, attendance } = await runStudentAttendanceTransaction(studentId, async (connection, lockedStudent) => {
            const activeAttendance = await getLockedActiveAttendance(connection, lockedStudent.id);

            if (activeAttendance) {
                throw createHttpError(409, 'Student is already checked in.', {
                    activeAttendance,
                    student_name: `${lockedStudent.first_name} ${lockedStudent.last_name}`
                });
            }

            return {
                attendance: await createLockedCheckIn(connection, lockedStudent, purpose, actor)
            };
        });

        console.log('Created attendance record:', attendance);
        res.status(201).json({
            id: attendance.id,
            student_name: `${student.first_name} ${student.last_name}`,
            student_id: student.id,
            purpose: attendance.purpose,
            check_in: attendance.check_in
        });
    } catch (error) {
        console.error('Admin check-in error:', error);
        res.status(error.status || 500).json({
            error: error.message || 'Could not create attendance record',
            ...(error.activeAttendance ? { activeAttendance: error.activeAttendance } : {}),
            ...(error.student_name ? { student_name: error.student_name } : {})
        });
    }
});

// Get active attendance records
router.get('/active', (req, res) => {
    const currentManilaTime = getSqlDateTimeInManila();
    const query = `
        SELECT al.*, s.student_id, s.first_name, s.last_name, s.middle_name, s.course, s.year_level, s.section,
               s.email, s.gender, s.address, s.profile_image,
               GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, ?), 0) as minutes_inside
        FROM attendance_logs al
        JOIN students s ON al.student_id = s.id
        WHERE al.check_out IS NULL
        ORDER BY al.check_in DESC
    `;
    
    db.query(query, [currentManilaTime], (err, results) => {
        if (err) {
            console.error('Active attendance query error:', err);
            res.status(500).json({ error: 'Unable to load active visitors right now.' });
            return;
        }
        res.json(results);
    });
});

router.get('/tracker', (req, res) => {
    const period = `${req.query.period || 'today'}`.toLowerCase();
    const status = `${req.query.status || 'all'}`.toLowerCase();
    const currentManilaTime = getSqlDateTimeInManila();
    const currentManilaDate = getSqlDateInManila();
    const currentWeekStart = getStartOfWeekDateInManila();
    const currentWeekEnd = getEndOfWeekDateInManila();
    const currentMonthStart = getStartOfMonthDateInManila();
    const currentMonthEnd = getEndOfMonthDateInManila();

    const allowedPeriods = new Set(['today', 'week', 'month', 'all']);
    const allowedStatuses = new Set(['all', 'pending', 'completed']);

    if (!allowedPeriods.has(period)) {
        return res.status(400).json({ error: 'Invalid period filter.' });
    }

    if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Invalid status filter.' });
    }

    const periodClauses = {
        today: {
            clause: 'DATE(COALESCE(al.check_out, al.check_in)) = ?',
            params: [currentManilaDate]
        },
        week: {
            clause: 'DATE(COALESCE(al.check_out, al.check_in)) BETWEEN ? AND ?',
            params: [currentWeekStart, currentWeekEnd]
        },
        month: {
            clause: 'DATE(COALESCE(al.check_out, al.check_in)) BETWEEN ? AND ?',
            params: [currentMonthStart, currentMonthEnd]
        },
        all: {
            clause: '1 = 1',
            params: []
        }
    };

    const statusClauses = {
        all: {
            clause: '1 = 1',
            params: []
        },
        pending: {
            clause: 'al.check_out IS NULL',
            params: []
        },
        completed: {
            clause: 'al.check_out IS NOT NULL',
            params: []
        }
    };

    const whereClauses = [];
    const whereParams = [];

    if (periodClauses[period].clause !== '1 = 1') {
        whereClauses.push(periodClauses[period].clause);
        whereParams.push(...periodClauses[period].params);
    }

    if (statusClauses[status].clause !== '1 = 1') {
        whereClauses.push(statusClauses[status].clause);
        whereParams.push(...statusClauses[status].params);
    }

    const whereStatement = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const summaryQuery = `
        SELECT
            COUNT(CASE WHEN check_out IS NOT NULL AND DATE(check_out) = ? THEN 1 END) AS today_checked_out,
            COUNT(CASE WHEN check_out IS NOT NULL AND DATE(check_out) BETWEEN ? AND ? THEN 1 END) AS week_checked_out,
            COUNT(CASE WHEN check_out IS NOT NULL AND DATE(check_out) BETWEEN ? AND ? THEN 1 END) AS month_checked_out,
            COUNT(CASE WHEN check_out IS NULL THEN 1 END) AS pending_count,
            COUNT(CASE WHEN check_out IS NOT NULL THEN 1 END) AS completed_count
        FROM attendance_logs
    `;
    const summaryParams = [
        currentManilaDate,
        currentWeekStart,
        currentWeekEnd,
        currentMonthStart,
        currentMonthEnd
    ];

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
            DATE_FORMAT(al.check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
            DATE_FORMAT(al.check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
            CASE
                WHEN al.check_out IS NULL THEN 'Pending'
                ELSE 'Completed'
            END AS status,
            CASE
                WHEN al.check_out IS NULL THEN GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, ?), 0)
                ELSE GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0)
            END AS duration_minutes
        FROM attendance_logs al
        JOIN students s ON al.student_id = s.id
        ${whereStatement}
        ORDER BY COALESCE(al.check_out, al.check_in) DESC
        LIMIT 200
    `;
    const recordsParams = [currentManilaTime, ...whereParams];

    db.query(summaryQuery, summaryParams, (summaryErr, summaryResults) => {
        if (summaryErr) {
            console.error('Attendance tracker summary query error:', summaryErr);
            return res.status(500).json({ error: 'Unable to load the attendance tracker right now.' });
        }

        db.query(recordsQuery, recordsParams, (recordsErr, recordResults) => {
            if (recordsErr) {
                console.error('Attendance tracker records query error:', recordsErr);
                return res.status(500).json({ error: 'Unable to load the attendance tracker right now.' });
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
    const checkoutTime = getSqlDateTimeInManila();
    const actor = getActor(req);

    // Only close a visit that is still open, so re-posting can never overwrite
    // the check_out timestamp of an already-completed record.
    db.query('UPDATE attendance_logs SET check_out = ?, checked_out_by = ? WHERE id = ? AND check_out IS NULL',
        [checkoutTime, actor, req.params.id],
        (err, result) => {
            if (err) {
                console.error('Manual check-out error:', err);
                res.status(500).json({ error: 'Unable to check out that record right now.' });
                return;
            }

            if (result.affectedRows === 0) {
                res.status(409).json({ error: 'That attendance record was not found or is already checked out.' });
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
            console.error('Attendance export query error:', err);
            res.status(500).json({ error: 'Unable to export attendance activity right now.' });
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
                console.error('Attendance export stats query error:', statsErr);
                res.status(500).json({ error: 'Unable to export attendance activity right now.' });
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
