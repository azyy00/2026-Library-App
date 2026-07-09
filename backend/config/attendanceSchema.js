const db = require('./db');

const dbPromise = db.promise();
const ATTENDANCE_TABLE = 'attendance_logs';

let ensureAuditColumnsPromise = null;

const ensureColumn = async (columnName, columnDefinition) => {
  const [existingColumns] = await dbPromise.query(
    `SHOW COLUMNS FROM ${ATTENDANCE_TABLE} LIKE ?`,
    [columnName]
  );

  if (existingColumns.length === 0) {
    await dbPromise.query(`ALTER TABLE ${ATTENDANCE_TABLE} ADD COLUMN ${columnDefinition}`);
  }
};

// Adds the actor columns that record which employee (or the automated cutoff)
// performed each check-in and check-out, so every attendance action is attributable.
const ensureAttendanceAuditColumns = () => {
  if (!ensureAuditColumnsPromise) {
    ensureAuditColumnsPromise = (async () => {
      await ensureColumn('checked_in_by', 'checked_in_by VARCHAR(60) DEFAULT NULL');
      await ensureColumn('checked_out_by', 'checked_out_by VARCHAR(60) DEFAULT NULL');
    })().catch((error) => {
      ensureAuditColumnsPromise = null;
      throw error;
    });
  }

  return ensureAuditColumnsPromise;
};

module.exports = {
  ensureAttendanceAuditColumns
};
