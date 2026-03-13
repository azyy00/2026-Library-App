const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', (req, res) => {
    const stats = {
        totalVisits: 0,
        activeVisitors: 0,
        visitsByPurpose: [],
        courseDistribution: [],
        dailyVisits: [],
        monthlyTrends: []
    };
    
    // Get total visits
    db.query('SELECT COUNT(*) as total FROM attendance_logs', (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        stats.totalVisits = results[0].total;
        
        // Get active visitors (those who checked in but haven't checked out)
        db.query('SELECT COUNT(*) as active FROM attendance_logs WHERE check_out IS NULL', (err, activeResults) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            stats.activeVisitors = activeResults[0].active;
            
            // Get visits by purpose
            db.query(`
                SELECT purpose, COUNT(*) as count 
                FROM attendance_logs 
                GROUP BY purpose 
                ORDER BY count DESC
            `, (err, purposeResults) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                stats.visitsByPurpose = purposeResults;
                
                // Get course distribution
                db.query(`
                    SELECT s.course, COUNT(DISTINCT s.id) as count
                    FROM students s
                    LEFT JOIN attendance_logs al ON s.id = al.student_id
                    GROUP BY s.course
                    ORDER BY count DESC
                `, (err, courseResults) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    stats.courseDistribution = courseResults;
                    
                    // Get daily visits for the last 7 days
                    db.query(`
                        SELECT 
                            DATE(check_in) as date,
                            COUNT(*) as visits
                        FROM attendance_logs
                        WHERE check_in >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                        GROUP BY DATE(check_in)
                        ORDER BY date ASC
                    `, (err, dailyResults) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        stats.dailyVisits = dailyResults;
                        
                        // Get monthly trends for the last 6 months
                        db.query(`
                            SELECT 
                                DATE_FORMAT(check_in, '%Y-%m') as month,
                                COUNT(*) as visits
                            FROM attendance_logs
                            WHERE check_in >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                            GROUP BY DATE_FORMAT(check_in, '%Y-%m')
                            ORDER BY month ASC
                        `, (err, monthlyResults) => {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            stats.monthlyTrends = monthlyResults;
                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;
