require('dotenv').config();

const fs = require('fs');
const mysql = require('mysql2');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(`${value}`.trim().toLowerCase());
};

const readEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
};

const caPath = readEnv('DB_SSL_CA_PATH', 'TIDB_CA_PATH');
const shouldEnableSsl = parseBoolean(
  readEnv('DB_SSL', 'TIDB_ENABLE_SSL'),
  Boolean(process.env.TIDB_HOST)
);

const dbConfig = {
  host: readEnv('DB_HOST', 'TIDB_HOST') || 'localhost',
  port: Number(readEnv('DB_PORT', 'TIDB_PORT') || 3306),
  user: readEnv('DB_USER', 'TIDB_USER') || 'root',
  password: readEnv('DB_PASSWORD', 'TIDB_PASSWORD') || '',
  database: readEnv('DB_NAME', 'TIDB_DATABASE') || 'library_attendance',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
};

if (shouldEnableSsl) {
  dbConfig.ssl = {
    rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true)
  };

  if (caPath && fs.existsSync(caPath)) {
    dbConfig.ssl.ca = fs.readFileSync(caPath);
  }
}

const pool = mysql.createPool(dbConfig);

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }

  console.log('Connected to database successfully');
  connection.release();
});

module.exports = pool;
