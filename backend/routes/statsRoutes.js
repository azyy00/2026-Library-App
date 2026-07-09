const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getManilaCalendarDate } = require('../config/manilaTime');

const dbPromise = db.promise();
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getCurrentManilaYear = () => getManilaCalendarDate(new Date()).getUTCFullYear();

const toCount = (value) => Number(value) || 0;

const buildAttendanceScope = (query = {}, availableYears = []) => {
    const currentYear = getCurrentManilaYear();
    const fallbackYear = availableYears[0] || currentYear;
    const requestedYear = Number.parseInt(`${query.year || fallbackYear}`, 10);
    const selectedYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= currentYear + 10
        ? requestedYear
        : fallbackYear;

    const requestedMonth = `${query.month || 'all'}`.toLowerCase();
    let selectedMonth = 'all';

    if (requestedMonth !== 'all') {
        const parsedMonth = Number.parseInt(requestedMonth, 10);

        if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            const error = new Error('Invalid month filter.');
            error.status = 400;
            throw error;
        }

        selectedMonth = parsedMonth;
    }

    return {
        selectedYear,
        selectedMonth,
        label: selectedMonth === 'all'
            ? `All reports in ${selectedYear}`
            : `${MONTH_LABELS[selectedMonth - 1]} ${selectedYear}`
    };
};

const buildDateWhere = (column, selectedYear, selectedMonth) => {
    const clauses = [`YEAR(${column}) = ?`];
    const params = [selectedYear];

    if (selectedMonth !== 'all') {
        clauses.push(`MONTH(${column}) = ?`);
        params.push(selectedMonth);
    }

    return {
        clause: clauses.join(' AND '),
        params
    };
};

router.get('/', async (req, res) => {
    try {
        const [yearRows] = await dbPromise.query(`
            SELECT DISTINCT YEAR(check_in) AS year
            FROM attendance_logs
            WHERE check_in IS NOT NULL
            ORDER BY year DESC
        `);
        const currentYear = getCurrentManilaYear();
        const availableYears = Array.from(
            new Set([
                currentYear,
                ...yearRows
                    .map((row) => Number.parseInt(row.year, 10))
                    .filter((year) => Number.isInteger(year))
            ])
        ).sort((left, right) => right - left);

        const scope = buildAttendanceScope(req.query, availableYears);
        const attendanceWhere = buildDateWhere('check_in', scope.selectedYear, scope.selectedMonth);
        const aliasedAttendanceWhere = buildDateWhere('al.check_in', scope.selectedYear, scope.selectedMonth);

        const [[totalsRow]] = await dbPromise.query(`
            SELECT
                COUNT(*) AS totalVisits,
                COUNT(CASE WHEN check_out IS NULL THEN 1 END) AS activeVisitors
            FROM attendance_logs
            WHERE ${attendanceWhere.clause}
        `, attendanceWhere.params);

        const [purposeResults] = await dbPromise.query(`
            SELECT purpose, COUNT(*) AS count
            FROM attendance_logs
            WHERE ${attendanceWhere.clause}
            GROUP BY purpose
            ORDER BY count DESC, purpose ASC
        `, attendanceWhere.params);

        const [courseResults] = await dbPromise.query(`
            SELECT COALESCE(s.course, 'N/A') AS course, COUNT(*) AS count
            FROM attendance_logs al
            JOIN students s ON s.id = al.student_id
            WHERE ${aliasedAttendanceWhere.clause}
            GROUP BY COALESCE(s.course, 'N/A')
            ORDER BY count DESC, course ASC
        `, aliasedAttendanceWhere.params);

        const [programYearResults] = await dbPromise.query(`
            SELECT
                COALESCE(s.course, 'N/A') AS course,
                COALESCE(s.year_level, 0) AS year_level,
                COUNT(*) AS count
            FROM attendance_logs al
            JOIN students s ON s.id = al.student_id
            WHERE ${aliasedAttendanceWhere.clause}
            GROUP BY COALESCE(s.course, 'N/A'), COALESCE(s.year_level, 0)
            ORDER BY course ASC, year_level ASC
        `, aliasedAttendanceWhere.params);

        let dailyVisits = [];

        if (scope.selectedMonth === 'all') {
            const [monthlyBuckets] = await dbPromise.query(`
                SELECT MONTH(check_in) AS bucket_month, COUNT(*) AS visits
                FROM attendance_logs
                WHERE ${attendanceWhere.clause}
                GROUP BY MONTH(check_in)
                ORDER BY bucket_month ASC
            `, attendanceWhere.params);

            dailyVisits = monthlyBuckets.map((row) => {
                const monthNumber = Number(row.bucket_month) || 1;
                return {
                    date: `${scope.selectedYear}-${`${monthNumber}`.padStart(2, '0')}`,
                    label: `${MONTH_LABELS[monthNumber - 1]} ${scope.selectedYear}`,
                    visits: toCount(row.visits)
                };
            });
        } else {
            const [dailyBuckets] = await dbPromise.query(`
                SELECT DATE_FORMAT(check_in, '%Y-%m-%d') AS bucket_date, DAY(check_in) AS bucket_day, COUNT(*) AS visits
                FROM attendance_logs
                WHERE ${attendanceWhere.clause}
                GROUP BY DATE_FORMAT(check_in, '%Y-%m-%d'), DAY(check_in)
                ORDER BY bucket_date ASC
            `, attendanceWhere.params);

            dailyVisits = dailyBuckets.map((row) => ({
                date: row.bucket_date,
                label: `${MONTH_LABELS[scope.selectedMonth - 1]} ${toCount(row.bucket_day)}`,
                visits: toCount(row.visits)
            }));
        }

        const [monthlyResults] = await dbPromise.query(`
            SELECT MONTH(check_in) AS bucket_month, COUNT(*) AS visits
            FROM attendance_logs
            WHERE YEAR(check_in) = ?
            GROUP BY MONTH(check_in)
            ORDER BY bucket_month ASC
        `, [scope.selectedYear]);

        res.json({
            totalVisits: toCount(totalsRow?.totalVisits),
            activeVisitors: toCount(totalsRow?.activeVisitors),
            visitsByPurpose: purposeResults.map((row) => ({
                purpose: row.purpose,
                count: toCount(row.count)
            })),
            courseDistribution: courseResults.map((row) => ({
                course: row.course,
                count: toCount(row.count)
            })),
            dailyVisits,
            monthlyTrends: monthlyResults.map((row) => {
                const monthNumber = Number(row.bucket_month) || 1;

                return {
                    month: `${scope.selectedYear}-${`${monthNumber}`.padStart(2, '0')}`,
                    label: `${MONTH_LABELS[monthNumber - 1]} ${scope.selectedYear}`,
                    visits: toCount(row.visits)
                };
            }),
            programYearMatrix: programYearResults.map((row) => ({
                course: row.course,
                year_level: Number(row.year_level) || 0,
                count: toCount(row.count)
            })),
            filters: {
                year: scope.selectedYear,
                month: scope.selectedMonth,
                label: scope.label
            },
            availableYears
        });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Unable to load dashboard statistics.' });
    }
});

module.exports = router;
