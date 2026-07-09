# GCC Library Attendance & Monitoring System

A web-based attendance and monitoring platform for the **Goa Community College Library**. Library staff sign in to a protected admin console; students check in and out through a separate kiosk-style monitoring station that writes to the same live database.

The project is a two-part application:

- **React** frontend — the user interface for staff and the kiosk
- **Express** backend — authentication, student records, attendance, reporting, and the book catalog

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Attendance Engine](#5-attendance-engine)
6. [Data Model](#6-data-model)
7. [API Reference](#7-api-reference)
8. [Authentication & Security](#8-authentication--security)
9. [Local Setup](#9-local-setup)
10. [Deployment](#10-deployment)
11. [Project Structure](#11-project-structure)
12. [Security Notes & Roadmap](#12-security-notes--roadmap)

---

## 1. System Overview

The system serves two audiences from one codebase and one database:

| User | Where they work | What they can do |
|------|-----------------|------------------|
| **Library staff / admin** | Protected admin console | Manage students, monitor attendance, view analytics, manage the book catalog, update their own account |
| **Students** | Kiosk monitoring station | Look up their ID, check in / check out, register if not yet on record |

The kiosk writes attendance directly into the shared database, so the admin dashboard always reflects the latest activity in real time. The kiosk station itself is opened by authorized staff — it is not a public, unauthenticated endpoint.

---

## 2. Features

### Admin console
- Employee login with token-protected routes
- Dashboard: total visits, active visitors, purpose distribution, course distribution, and trends
- Student registration, editing, profile viewing, and profile-image uploads
- Attendance tracker with period (today / week / month / all) and status (pending / completed) filters
- Active-visitor list with live "minutes inside" per student
- Manual check-out override for individual records
- Data export of all attendance activity
- Book catalog and inventory management
- Self-service admin profile update (name, username, password, photo)

### Kiosk monitoring station
- Student-ID lookup with profile preview
- Explicit **Check in** / **Check out** actions, plus a single-scan endpoint that toggles automatically
- Purpose selection required on check-in
- Hourly check-in count for the current day (6 AM – 5 PM)
- Separate registration page for students not yet encoded
- **5:00 PM cutoff**: new check-ins are blocked and open visits are auto-closed

---

## 3. Tech Stack

**Frontend** — React 18, React Router DOM, Axios, Bootstrap 5, Chart.js / react-chartjs-2, `xlsx`, `file-saver`

**Backend** — Node.js 20, Express, `mysql2`, `cors`, `dotenv`, `multer`, and Node's native `crypto` for password hashing (scrypt) and token signing (HMAC-SHA256)

**Data & storage** — TiDB Cloud (production, MySQL-compatible), MySQL (local dev), Cloudinary (production profile images)

**Deployment** — Vercel (frontend + backend as two projects), Git / GitHub, Nodemon, `concurrently`

---

## 4. Architecture

```text
Students / Staff
      |
      v
React Frontend (Vercel)
      |
      v  HTTPS + Bearer token
Express API (Vercel serverless)
      |
      +--> TiDB Cloud / MySQL   (student, attendance, employee, book data)
      |
      +--> Cloudinary           (profile image storage)
```

The frontend is a static React build; the backend is an Express app exposed through `backend/api/index.js` as a Vercel serverless function. Database and image storage are external services because Vercel provides no persistent local filesystem.

---

## 5. Attendance Engine

The attendance flow is the core of the system and is built for correctness under concurrent use.

### Check-in / check-out lifecycle
1. A student ID is submitted at the kiosk.
2. The backend opens a transaction and takes a **row lock** (`SELECT ... FOR UPDATE`) on the student and their open session.
3. If no open session exists → a new `check_in` row is created (purpose required).
   If an open session exists → it is closed with a `check_out` timestamp.
4. The transaction commits; the dashboard reflects the change immediately.

Row-level locking inside a transaction (`runStudentAttendanceTransaction` in [`backend/routes/attendanceRoutes.js`](backend/routes/attendanceRoutes.js)) prevents duplicate open sessions from rapid or double scans.

### Timezone handling
All timestamps and duration math flow through [`backend/config/manilaTime.js`](backend/config/manilaTime.js), pinning the system to **Asia/Manila** regardless of server locale. This keeps durations, daily buckets, and the cutoff consistent in production.

### 5:00 PM cutoff
Defined in [`backend/config/attendanceCutoff.js`](backend/config/attendanceCutoff.js):

- **New check-ins are rejected** after 5:00 PM (`isAfterCutoff`).
- **Open visits are auto-closed** by a sweep that sets `check_out` to the 5:00 PM boundary.

The sweep runs in two modes:
- On **every `/api` request** (safe for Vercel's stateless serverless model).
- On a **60-second interval** when running as a long-lived local process.

### Reporting
- `GET /api/attendance/active` — everyone currently inside, with live minutes elapsed.
- `GET /api/attendance/tracker` — filtered records plus summary counts (today / week / month, pending / completed), capped at 200 rows.
- `GET /api/attendance/export` — full activity dataset with computed durations and status for spreadsheet export.

---

## 6. Data Model

Four core tables (`backend/database/schema-production.sql`):

### `students`
Student identity and profile. Key fields: `student_id` (external ID, unique), `first_name`, `last_name`, `middle_name`, `course`, `year_level`, `section`, `email`, `gender`, `address`, `profile_image`.

### `attendance_logs`
One row per library visit. Fields: `student_id` (FK → `students.id`, `ON DELETE CASCADE`), `purpose`, `check_in`, `check_out`. An open visit has `check_out IS NULL`.

### `employee_accounts`
Staff login accounts. Fields: `username` (unique), `password_hash` (scrypt, salted), `full_name`, `title`, `email`, `phone_number`, `profile_note`, `profile_image`.

### `books`
Library catalog and inventory: bibliographic details, `copies`, subjects, call/accession numbers, and acquisition metadata.

---

## 7. API Reference

Base path: `/api`. All routes except `/api/auth/login`, `/api/auth/logout`, and `/api/books` require an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Authenticate; returns token + employee |
| GET | `/session` | Validate token, return current employee |
| GET | `/profile` | Load employee profile |
| PUT | `/profile` | Update profile (requires current password) |
| POST | `/profile-image` | Upload/replace profile photo |
| POST | `/logout` | Client-side session end |

### Attendance — `/api/attendance` *(auth required)*
| Method | Path | Description |
|--------|------|-------------|
| GET | `/kiosk/summary` | Today's totals + hourly buckets + recent activity |
| GET | `/kiosk/student/:studentId` | Kiosk lookup with check-in state |
| POST | `/kiosk/check-in` | Kiosk check-in (purpose required) |
| POST | `/kiosk/check-out` | Kiosk check-out |
| POST | `/kiosk/scan` | Single-scan auto toggle (in ↔ out) |
| POST | `/checkin` | Admin check-in |
| POST | `/checkout/:id` | Manual check-out of one record |
| GET | `/active` | Everyone currently inside |
| GET | `/tracker` | Filtered records + summary counts |
| GET | `/export` | Full activity export |

### Other
- `/api/students` *(auth)* — CRUD, search, profile images, profiles with recent activity
- `/api/stats` *(auth)* — dashboard chart + summary data
- `/api/books` *(public)* — book catalog and inventory

---

## 8. Authentication & Security

Staff-only authentication protects the admin console and the kiosk.

**How it works**
1. Staff log in with username + password.
2. Credentials are checked against `employee_accounts`; passwords are stored as salted **scrypt** hashes and compared in constant time.
3. On success the server issues a **stateless HMAC-SHA256 token** (`payload.signature`, base64url) with a configurable TTL (default 12 h).
4. The frontend sends the token as a `Bearer` header; [`requireEmployeeAuth`](backend/config/auth.js) rejects any request with a missing, tampered, or expired token.

**Notes**
- The signing secret comes from `AUTH_SECRET`; if unset, it is derived from configured credentials. **Set `AUTH_SECRET` explicitly in production.**
- In local development, a fallback account (`library-admin` / `library123`) is available only when no employee is configured and `NODE_ENV` is not `production`.
- On first run, the backend auto-creates the `employee_accounts` table and seeds it from environment variables.

See [Security Notes & Roadmap](#12-security-notes--roadmap) for known limitations.

---

## 9. Local Setup

### Requirements
- Node.js 20.x and npm
- MySQL (or a TiDB-compatible database)

### Install
```bash
npm install          # frontend deps (from project root)
cd backend
npm install          # backend deps
```

### Environment

**Frontend** (`.env` at root):
```env
REACT_APP_API_URL=http://localhost:3001/api
```

**Backend** (`backend/.env`):
```env
PORT=3001
CLIENT_ORIGIN=http://localhost:3000

EMPLOYEE_USERNAME=librarian
EMPLOYEE_PASSWORD=change_me
AUTH_SECRET=generate_a_long_random_string

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=library_attendance

FILE_STORAGE=local
```

### Run
```bash
npm run dev          # frontend + backend together (from root)

npm start            # frontend only
cd backend && npm run dev   # backend only
```

---

## 10. Deployment

Deployed as **two Vercel projects** — a static React build from the repo root, and the Express API from `backend/`.

**Frontend** — Create React App; build `npm run build`, output `build`; root `vercel.json` rewrites all paths to `index.html`.

**Backend** — Express exposed via `backend/api/index.js`; Node 20.x; rewrites in `backend/vercel.json`.

Production environment variables (set in Vercel):
```env
CLIENT_ORIGIN=https://your-frontend-project.vercel.app
AUTH_SECRET=your_long_random_secret

EMPLOYEE_USERNAME=librarian
EMPLOYEE_PASSWORD=change_me
EMPLOYEE_NAME=GCC Library Staff
EMPLOYEE_TITLE=Library Administrator

FILE_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

TIDB_HOST=your_tidb_host
TIDB_PORT=4000
TIDB_USER=your_tidb_user
TIDB_PASSWORD=your_tidb_password
TIDB_DATABASE=library_attendance
TIDB_ENABLE_SSL=true
```

**Why TiDB Cloud** — MySQL-compatible, so the existing schema and queries run unchanged.
**Why Cloudinary** — Vercel's filesystem is ephemeral; uploaded images must live in external storage.

---

## 11. Project Structure

```text
2026-Library-App/
├── backend/
│   ├── api/index.js            # Vercel serverless entry
│   ├── config/
│   │   ├── auth.js             # login, hashing, tokens, requireEmployeeAuth
│   │   ├── db.js               # MySQL/TiDB connection pool (+ SSL)
│   │   ├── storage.js          # local vs Cloudinary strategy
│   │   ├── attendanceCutoff.js # 5 PM cutoff + auto-checkout sweep
│   │   └── manilaTime.js       # Asia/Manila time helpers
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── studentRoutes.js
│   │   ├── statsRoutes.js
│   │   └── bookRoutes.js
│   ├── database/schema-production.sql
│   └── server.js               # app assembly, CORS, route mounting
├── database/                   # schema variants
├── public/
├── src/
│   ├── components/
│   ├── pages/                  # Login, Dashboard, AttendanceMonitoring, ...
│   ├── layouts/
│   ├── context/                # AuthContext
│   └── services/api.js
└── package.json
```

---

## 12. Security Notes & Roadmap

Findings from the internal audit of the attendance and auth subsystems, ordered by priority. The check-in engine itself is sound (transactional row-locking, parameterized queries, timezone-safe, dual-mode cutoff); these are the areas to harden next.

- [ ] **Audit trail** — `attendance_logs` records the student and times but not *which employee* performed a check-in, manual checkout, or edit. Add an actor column (or a dedicated audit table) so every action is attributable.
- [ ] **Login rate limiting** — `POST /api/auth/login` is currently unthrottled; add throttling/lockout to resist brute-force.
- [ ] **Sanitize 500 responses** — `/active`, `/tracker`, `/checkout/:id`, and `/export` return raw DB error messages; replace with generic messages and log internally.
- [ ] **Guard `POST /checkout/:id`** — verify the target visit is still open before writing `check_out`, so re-posting can't overwrite a completed record.
- [ ] **Confirm `/api/books` access policy** — it is the only unauthenticated data route; gate it behind `requireEmployeeAuth` if the catalog is not meant to be public.
- [ ] **Lock down CORS** — when `CLIENT_ORIGIN` is unset the API accepts all origins; require an explicit allowlist in production.
- [ ] **Token revocation** — tokens are stateless and valid until expiry; logout is client-side only. Consider a short TTL plus refresh, or a server-side denylist, for immediate revocation.

---

*Built for real school-library operations: attendance is recorded by students at the kiosk while remaining fully managed and monitored by authorized library staff.*
