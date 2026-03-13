const db = require('./db');

const CUTOFF_HOUR = 17;
const CUTOFF_MINUTE = 0;
const CUTOFF_LABEL = '5:00 PM';

const isAfterCutoff = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return hours > CUTOFF_HOUR || (hours === CUTOFF_HOUR && minutes >= CUTOFF_MINUTE);
};

const autoCheckoutExpiredSessions = () =>
  new Promise((resolve, reject) => {
    const query = `
      UPDATE attendance_logs
      SET check_out = CASE
        WHEN TIME(check_in) >= '17:00:00' THEN check_in
        ELSE DATE_ADD(DATE(check_in), INTERVAL 17 HOUR)
      END
      WHERE check_out IS NULL
        AND NOW() >= DATE_ADD(DATE(check_in), INTERVAL 17 HOUR)
    `;

    db.query(query, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      if (result.affectedRows > 0) {
        console.log(`Automatically checked out ${result.affectedRows} active visitor(s) at the ${CUTOFF_LABEL} cutoff.`);
      }

      resolve(result.affectedRows || 0);
    });
  });

const startAttendanceCutoffScheduler = () => {
  const runCutoffSweep = async () => {
    try {
      await autoCheckoutExpiredSessions();
    } catch (error) {
      console.error('Error applying the 5:00 PM attendance cutoff:', error);
    }
  };

  runCutoffSweep();
  return setInterval(runCutoffSweep, 60 * 1000);
};

module.exports = {
  CUTOFF_LABEL,
  autoCheckoutExpiredSessions,
  isAfterCutoff,
  startAttendanceCutoffScheduler
};
