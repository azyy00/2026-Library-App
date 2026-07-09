const db = require('./db');
const { getManilaClock, getSqlDateTimeInManila } = require('./manilaTime');
const { ensureAttendanceAuditColumns } = require('./attendanceSchema');

const dbPromise = db.promise();
const CUTOFF_HOUR = 17;
const CUTOFF_MINUTE = 0;
const CUTOFF_LABEL = '5:00 PM';
const AUTO_CHECKOUT_ACTOR = 'system (5:00 PM cutoff)';

const isAfterCutoff = (date = new Date()) => {
  const { hour: hours, minute: minutes } = getManilaClock(date);

  return hours > CUTOFF_HOUR || (hours === CUTOFF_HOUR && minutes >= CUTOFF_MINUTE);
};

const autoCheckoutExpiredSessions = async () => {
  await ensureAttendanceAuditColumns();

  const currentManilaTime = getSqlDateTimeInManila();
  const [result] = await dbPromise.query(
    `
      UPDATE attendance_logs
      SET check_out = CASE
          WHEN TIME(check_in) >= '17:00:00' THEN check_in
          ELSE DATE_ADD(DATE(check_in), INTERVAL 17 HOUR)
        END,
        checked_out_by = COALESCE(checked_out_by, ?)
      WHERE check_out IS NULL
        AND ? >= DATE_ADD(DATE(check_in), INTERVAL 17 HOUR)
    `,
    [AUTO_CHECKOUT_ACTOR, currentManilaTime]
  );

  if (result.affectedRows > 0) {
    console.log(`Automatically checked out ${result.affectedRows} active visitor(s) at the ${CUTOFF_LABEL} cutoff.`);
  }

  return result.affectedRows || 0;
};

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
