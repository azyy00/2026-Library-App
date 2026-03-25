require('dotenv').config();

const crypto = require('crypto');
const db = require('./db');

const dbPromise = db.promise();
const EMPLOYEE_TABLE = 'employee_accounts';
const DEFAULT_TOKEN_TTL_HOURS = 12;
const DEFAULT_EMPLOYEE_TITLE = 'Library employee access';
const DEFAULT_DEV_EMPLOYEE = {
  username: 'library-admin',
  password: 'library123',
  name: 'Local Library Admin',
  title: 'Library Administrator',
  email: '',
  phone: '',
  info: 'Local development account',
  profileImage: ''
};

let ensureEmployeeStorePromise = null;

const isProductionRuntime = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(`${left ?? ''}`, 'utf8');
  const rightBuffer = Buffer.from(`${right ?? ''}`, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(`${password}`, salt, 64).toString('hex');

  return `${salt}:${hash}`;
};

const verifyPasswordHash = (password, storedHash) => {
  const [salt, hash] = `${storedHash || ''}`.split(':');

  if (!salt || !hash) {
    return safeEqual(storedHash, password);
  }

  const derivedHash = crypto.scryptSync(`${password}`, salt, 64).toString('hex');
  return safeEqual(hash, derivedHash);
};

const normalizeEmployee = (employee) => ({
  id: employee.id ?? null,
  username: `${employee.username || ''}`.trim(),
  name: `${employee.full_name || employee.name || employee.username || 'Library Employee'}`.trim(),
  title: `${employee.title || DEFAULT_EMPLOYEE_TITLE}`.trim(),
  email: `${employee.email || ''}`.trim(),
  phone: `${employee.phone_number || employee.phone || ''}`.trim(),
  info: `${employee.profile_note || employee.info || ''}`.trim(),
  profileImage: `${employee.profile_image || employee.profileImage || ''}`.trim(),
  role: 'library_employee'
});

const parseEmployeeAccounts = () => {
  const rawAccounts = `${process.env.EMPLOYEE_ACCOUNTS_JSON || ''}`.trim();

  if (rawAccounts) {
    try {
      const parsedAccounts = JSON.parse(rawAccounts);

      if (!Array.isArray(parsedAccounts)) {
        return [];
      }

      return parsedAccounts
        .map((employee) => ({
          username: `${employee?.username || ''}`.trim(),
          password: `${employee?.password || ''}`,
          name: `${employee?.name || employee?.username || ''}`.trim(),
          title: `${employee?.title || 'Library Administrator'}`.trim(),
          email: `${employee?.email || ''}`.trim(),
          phone: `${employee?.phone || ''}`.trim(),
          info: `${employee?.info || ''}`.trim()
        }))
        .filter((employee) => employee.username && employee.password);
    } catch (error) {
      console.error('Unable to parse EMPLOYEE_ACCOUNTS_JSON:', error.message);
      return [];
    }
  }

  const username = `${process.env.EMPLOYEE_USERNAME || ''}`.trim();
  const password = `${process.env.EMPLOYEE_PASSWORD || ''}`;

  if (username && password) {
    return [{
      username,
      password,
      name: `${process.env.EMPLOYEE_NAME || 'Library Administrator'}`.trim() || username,
      title: `${process.env.EMPLOYEE_TITLE || 'Library Administrator'}`.trim(),
      email: `${process.env.EMPLOYEE_EMAIL || ''}`.trim(),
      phone: `${process.env.EMPLOYEE_PHONE || ''}`.trim(),
      info: `${process.env.EMPLOYEE_INFO || ''}`.trim()
    }];
  }

  if (!isProductionRuntime()) {
    return [DEFAULT_DEV_EMPLOYEE];
  }

  return [];
};

const getConfiguredEmployees = () => parseEmployeeAccounts();

const getTokenTtlMs = () => {
  const configuredHours = Number(process.env.AUTH_TOKEN_TTL_HOURS || DEFAULT_TOKEN_TTL_HOURS);
  const safeHours = Number.isFinite(configuredHours) && configuredHours > 0
    ? configuredHours
    : DEFAULT_TOKEN_TTL_HOURS;

  return safeHours * 60 * 60 * 1000;
};

const getSigningSecret = () => {
  const configuredSecret = `${process.env.AUTH_SECRET || process.env.AUTH_TOKEN_SECRET || ''}`.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  const configuredEmployees = getConfiguredEmployees();

  if (configuredEmployees.length > 0) {
    return crypto
      .createHash('sha256')
      .update(
        configuredEmployees
          .map((employee) => `${employee.username}:${employee.password}`)
          .sort()
          .join('|')
      )
      .digest('hex');
  }

  return crypto
    .createHash('sha256')
    .update([
      process.env.DB_HOST || process.env.TIDB_HOST || 'localhost',
      process.env.DB_NAME || process.env.TIDB_DATABASE || 'library_attendance',
      process.env.DB_USER || process.env.TIDB_USER || 'root',
      'gcc-library-auth-fallback'
    ].join('|'))
    .digest('hex');
};

const createAuthToken = (employee) => {
  const payload = JSON.stringify({
    id: employee.id ?? null,
    username: employee.username,
    name: employee.name,
    title: employee.title || DEFAULT_EMPLOYEE_TITLE,
    role: employee.role || 'library_employee',
    exp: Date.now() + getTokenTtlMs()
  });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
};

const verifyAuthToken = (token) => {
  if (!token) {
    throw new Error('Authentication is required.');
  }

  const [encodedPayload, signature] = `${token}`.split('.');

  if (!encodedPayload || !signature) {
    throw new Error('Invalid authentication token.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    throw new Error('Invalid authentication token.');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

  if (!payload?.exp || payload.exp < Date.now()) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  return {
    id: payload.id ?? null,
    username: payload.username,
    name: payload.name,
    title: payload.title || DEFAULT_EMPLOYEE_TITLE,
    role: payload.role
  };
};

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return '';
  }

  return authorizationHeader.slice('Bearer '.length).trim();
};

const ensureEmployeeAccountsTable = async () => {
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS ${EMPLOYEE_TABLE} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(60) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      title VARCHAR(120) DEFAULT '${DEFAULT_EMPLOYEE_TITLE}',
      email VARCHAR(120) DEFAULT NULL,
      phone_number VARCHAR(40) DEFAULT NULL,
      profile_note TEXT,
      profile_image VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const ensureEmployeeProfileImageColumn = async () => {
  const [columnRows] = await dbPromise.query(
    `SHOW COLUMNS FROM ${EMPLOYEE_TABLE} LIKE 'profile_image'`
  );

  if (columnRows.length === 0) {
    await dbPromise.query(
      `ALTER TABLE ${EMPLOYEE_TABLE} ADD COLUMN profile_image VARCHAR(255) DEFAULT NULL`
    );
  }
};

const seedConfiguredEmployees = async () => {
  const [countRows] = await dbPromise.query(`SELECT COUNT(*) AS total FROM ${EMPLOYEE_TABLE}`);

  if ((countRows[0]?.total || 0) > 0) {
    return;
  }

  const configuredEmployees = getConfiguredEmployees();

  if (configuredEmployees.length === 0) {
    return;
  }

  for (const employee of configuredEmployees) {
    await dbPromise.query(
      `INSERT INTO ${EMPLOYEE_TABLE}
        (username, password_hash, full_name, title, email, phone_number, profile_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.username,
        hashPassword(employee.password),
        employee.name || employee.username,
        employee.title || 'Library Administrator',
        employee.email || null,
        employee.phone || null,
        employee.info || null
      ]
    );
  }
};

const ensureEmployeeStoreReady = async () => {
  if (!ensureEmployeeStorePromise) {
    ensureEmployeeStorePromise = (async () => {
      await ensureEmployeeAccountsTable();
      await ensureEmployeeProfileImageColumn();
      await seedConfiguredEmployees();
    })().catch((error) => {
      ensureEmployeeStorePromise = null;
      throw error;
    });
  }

  return ensureEmployeeStorePromise;
};

const findStoredEmployeeByUsername = async (username) => {
  const [rows] = await dbPromise.query(
    `SELECT * FROM ${EMPLOYEE_TABLE} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
    [username]
  );

  return rows[0] || null;
};

const findStoredEmployeeById = async (id) => {
  if (!id) {
    return null;
  }

  const [rows] = await dbPromise.query(
    `SELECT * FROM ${EMPLOYEE_TABLE} WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
};

const authenticateConfiguredEmployee = (username, password) => {
  const configuredEmployees = getConfiguredEmployees();

  if (configuredEmployees.length === 0) {
    return null;
  }

  const normalizedUsername = `${username || ''}`.trim().toLowerCase();
  const normalizedPassword = `${password || ''}`;
  const matchedEmployee = configuredEmployees.find((employee) => (
    employee.username.toLowerCase() === normalizedUsername
    && safeEqual(employee.password, normalizedPassword)
  ));

  return matchedEmployee ? normalizeEmployee(matchedEmployee) : null;
};

const authenticateEmployee = async (username, password) => {
  const normalizedUsername = `${username || ''}`.trim();
  const normalizedPassword = `${password || ''}`;

  if (!normalizedUsername || !normalizedPassword) {
    return {
      ok: false,
      status: 400,
      message: 'Employee username and password are required.'
    };
  }

  try {
    await ensureEmployeeStoreReady();
    const storedEmployee = await findStoredEmployeeByUsername(normalizedUsername);

    if (!storedEmployee) {
      return {
        ok: false,
        status: 401,
        message: 'Invalid employee username or password.'
      };
    }

    if (!verifyPasswordHash(normalizedPassword, storedEmployee.password_hash)) {
      return {
        ok: false,
        status: 401,
        message: 'Invalid employee username or password.'
      };
    }

    return {
      ok: true,
      employee: normalizeEmployee(storedEmployee)
    };
  } catch (error) {
    console.error('Employee auth store unavailable, falling back to configured credentials:', error.message);
    const configuredEmployee = authenticateConfiguredEmployee(normalizedUsername, normalizedPassword);

    if (configuredEmployee) {
      return {
        ok: true,
        employee: configuredEmployee
      };
    }

    return {
      ok: false,
      status: 503,
      message: 'Employee login is temporarily unavailable. Please try again.'
    };
  }
};

const getEmployeeProfile = async (employeeIdentity) => {
  try {
    await ensureEmployeeStoreReady();
    const storedEmployee = employeeIdentity?.id
      ? await findStoredEmployeeById(employeeIdentity.id)
      : await findStoredEmployeeByUsername(employeeIdentity?.username || '');

    if (storedEmployee) {
      return normalizeEmployee(storedEmployee);
    }
  } catch (error) {
    console.error('Unable to load employee profile from store:', error.message);
  }

  return normalizeEmployee(employeeIdentity || {});
};

const updateEmployeeProfile = async (employeeIdentity, payload) => {
  await ensureEmployeeStoreReady();

  const storedEmployee = employeeIdentity?.id
    ? await findStoredEmployeeById(employeeIdentity.id)
    : await findStoredEmployeeByUsername(employeeIdentity?.username || '');

  if (!storedEmployee) {
    return {
      ok: false,
      status: 404,
      message: 'Employee account not found.'
    };
  }

  const nextUsername = `${payload?.username || ''}`.trim();
  const nextName = `${payload?.name || ''}`.trim();
  const nextTitle = `${payload?.title || ''}`.trim() || DEFAULT_EMPLOYEE_TITLE;
  const nextEmail = `${payload?.email || ''}`.trim();
  const nextPhone = `${payload?.phone || ''}`.trim();
  const nextInfo = `${payload?.info || ''}`.trim();
  const currentPassword = `${payload?.currentPassword || ''}`;
  const newPassword = `${payload?.newPassword || ''}`;

  if (!nextUsername || !nextName) {
    return {
      ok: false,
      status: 400,
      message: 'Admin name and username are required.'
    };
  }

  if (!currentPassword) {
    return {
      ok: false,
      status: 400,
      message: 'Enter your current password to save account changes.'
    };
  }

  if (!verifyPasswordHash(currentPassword, storedEmployee.password_hash)) {
    return {
      ok: false,
      status: 401,
      message: 'Current password is incorrect.'
    };
  }

  if (newPassword && newPassword.length < 8) {
    return {
      ok: false,
      status: 400,
      message: 'New password must be at least 8 characters long.'
    };
  }

  const [duplicateRows] = await dbPromise.query(
    `SELECT id FROM ${EMPLOYEE_TABLE} WHERE LOWER(username) = LOWER(?) AND id <> ? LIMIT 1`,
    [nextUsername, storedEmployee.id]
  );

  if (duplicateRows.length > 0) {
    return {
      ok: false,
      status: 409,
      message: 'That username is already being used by another employee account.'
    };
  }

  const nextPasswordHash = newPassword
    ? hashPassword(newPassword)
    : storedEmployee.password_hash;

  await dbPromise.query(
    `UPDATE ${EMPLOYEE_TABLE}
        SET username = ?,
            password_hash = ?,
            full_name = ?,
            title = ?,
            email = ?,
            phone_number = ?,
            profile_note = ?
      WHERE id = ?`,
    [
      nextUsername,
      nextPasswordHash,
      nextName,
      nextTitle,
      nextEmail || null,
      nextPhone || null,
      nextInfo || null,
      storedEmployee.id
    ]
  );

  const refreshedEmployee = await findStoredEmployeeById(storedEmployee.id);

  return {
    ok: true,
    employee: normalizeEmployee(refreshedEmployee)
  };
};

const updateEmployeeProfileImage = async (employeeIdentity, profileImagePath) => {
  await ensureEmployeeStoreReady();

  const storedEmployee = employeeIdentity?.id
    ? await findStoredEmployeeById(employeeIdentity.id)
    : await findStoredEmployeeByUsername(employeeIdentity?.username || '');

  if (!storedEmployee) {
    return {
      ok: false,
      status: 404,
      message: 'Employee account not found.'
    };
  }

  await dbPromise.query(
    `UPDATE ${EMPLOYEE_TABLE}
        SET profile_image = ?
      WHERE id = ?`,
    [profileImagePath || null, storedEmployee.id]
  );

  const refreshedEmployee = await findStoredEmployeeById(storedEmployee.id);

  return {
    ok: true,
    previousProfileImage: `${storedEmployee.profile_image || ''}`.trim(),
    employee: normalizeEmployee(refreshedEmployee)
  };
};

const requireEmployeeAuth = (req, res, next) => {
  try {
    req.employee = verifyAuthToken(getBearerToken(req.headers.authorization));
    next();
  } catch (error) {
    res.status(401).json({ error: error.message || 'Authentication is required.' });
  }
};

module.exports = {
  authenticateEmployee,
  createAuthToken,
  ensureEmployeeStoreReady,
  getConfiguredEmployees,
  getEmployeeProfile,
  requireEmployeeAuth,
  updateEmployeeProfile,
  updateEmployeeProfileImage,
  verifyAuthToken
};
