<div align="center">

<img src="./GCC-LOGO.png" alt="Goa Community College" width="110" />

# GCC Library Attendance &amp; Monitoring System

**A real-time attendance platform for the Goa Community College Library.**
Staff manage everything from a protected console — students check in and out at a kiosk.

<br />

![Node](https://img.shields.io/badge/Node.js-20.x-3C873A?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-1E1E1E?style=flat-square&logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express-4-1E1E1E?style=flat-square&logo=express&logoColor=white)
![Database](https://img.shields.io/badge/TiDB%20%2F%20MySQL-800000?style=flat-square&logo=mysql&logoColor=white)
![Deploy](https://img.shields.io/badge/Vercel-Serverless-1E1E1E?style=flat-square&logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/status-production-800000?style=flat-square)

<br />

[**Overview**](#-system-overview) · [**Features**](#-features) · [**Attendance Engine**](#-attendance-engine) · [**API**](#-api-reference) · [**Setup**](#-local-setup) · [**Deploy**](#-deployment) · [**Security**](#-security-notes--roadmap)

</div>

---

## 📖 System Overview

The system serves two audiences from **one codebase and one live database**. Everything students do at the kiosk appears on the staff dashboard instantly.

<table>
<tr>
<th align="left" width="180">Role</th>
<th align="left">Workspace</th>
<th align="left">Capabilities</th>
</tr>
<tr>
<td><b>🛡️ Library staff</b></td>
<td>Protected admin console</td>
<td>Manage students, monitor attendance, view analytics, run the book catalog, update their account</td>
</tr>
<tr>
<td><b>🎓 Students</b></td>
<td>Kiosk monitoring station</td>
<td>Look up their ID, check in / out, register if not yet on record</td>
</tr>
</table>

> [!NOTE]
> The kiosk is **opened by authorized staff** — it is not a public, unauthenticated endpoint. It writes directly to the shared database, so the admin dashboard always reflects live activity.

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🛡️ Admin Console
- Token-protected employee login
- Dashboard — visits, active visitors, purpose &amp; course distribution, trends
- Student registration, editing, and profiles
- Attendance tracker with **period** and **status** filters
- Live active-visitor list with *minutes inside*
- Manual check-out override
- Full activity **export**
- Book catalog &amp; inventory management
- Self-service profile &amp; photo update

</td>
<td width="50%" valign="top">

### 🎓 Kiosk Station
- Student-ID lookup with profile preview
- Explicit **Check in** / **Check out**
- Single-scan endpoint that toggles automatically
- Purpose selection required on check-in
- Hourly check-in count (6 AM – 5 PM)
- Separate registration for new students
- **5:00 PM cutoff** — blocks new check-ins and auto-closes open visits

</td>
</tr>
</table>

---

## 🧱 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 · React Router · Axios · Bootstrap 5 · Chart.js · `xlsx` · `file-saver` |
| **Backend** | Node.js 20 · Express · `mysql2` · `cors` · `multer` · native `crypto` (scrypt + HMAC-SHA256) |
| **Data &amp; Storage** | TiDB Cloud (prod) · MySQL (local) · Cloudinary (profile images) |
| **Deployment** | Vercel (frontend + backend) · Git / GitHub · Nodemon |

---

## 🏗️ Architecture

```text
                     Students / Staff
                            │
                            ▼
              ┌───────────────────────────┐
              │   React Frontend (Vercel)  │
              └───────────────────────────┘
                            │  HTTPS + Bearer token
                            ▼
              ┌───────────────────────────┐
              │  Express API (serverless)  │
              └───────────────────────────┘
                     │                │
                     ▼                ▼
        ┌────────────────────┐  ┌──────────────┐
        │  TiDB Cloud / MySQL │  │  Cloudinary  │
        │  students · logs ·  │  │  profile     │
        │  employees · books  │  │  images      │
        └────────────────────┘  └──────────────┘
```

The frontend is a static React build; the backend is an Express app exposed via `backend/api/index.js` as a Vercel serverless function. Data and images live in external services because Vercel has no persistent filesystem.

---

## ⚙️ Attendance Engine

The attendance flow is the heart of the system — built for **correctness under concurrent use**.

### 🔒 Check-in / check-out lifecycle

```text
Student ID submitted
        │
        ▼
Open transaction ── SELECT … FOR UPDATE (row lock on student + open session)
        │
        ├─ no open session ──▶ create check_in  (purpose required)
        └─ open session ─────▶ set check_out timestamp
        │
        ▼
Commit ──▶ dashboard updates instantly
```

Row-level locking inside a transaction (`runStudentAttendanceTransaction` in [`attendanceRoutes.js`](backend/routes/attendanceRoutes.js)) makes duplicate open sessions from rapid or double scans impossible.

### 🕔 Timezone &amp; the 5:00 PM cutoff

- **Asia/Manila everywhere.** All timestamps and duration math flow through [`manilaTime.js`](backend/config/manilaTime.js), so results are correct regardless of server locale.
- **New check-ins rejected** after 5:00 PM (`isAfterCutoff`).
- **Open visits auto-closed** to the 5:00 PM boundary by a sweep in [`attendanceCutoff.js`](backend/config/attendanceCutoff.js), running on **every `/api` request** (serverless-safe) *and* on a 60-second interval locally.

### 📊 Reporting endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /active` | Everyone currently inside, with live minutes elapsed |
| `GET /tracker` | Filtered records + summary counts (today / week / month · pending / completed), max 200 rows |
| `GET /export` | Full activity dataset with computed durations and status |

---

## 🗃️ Data Model

<table>
<tr><th align="left">Table</th><th align="left">Purpose &amp; key fields</th></tr>
<tr>
<td><code>students</code></td>
<td>Identity &amp; profile — <code>student_id</code> (unique), name fields, <code>course</code>, <code>year_level</code>, <code>section</code>, <code>email</code>, <code>gender</code>, <code>profile_image</code></td>
</tr>
<tr>
<td><code>attendance_logs</code></td>
<td>One row per visit — <code>student_id</code> (FK, <code>ON DELETE CASCADE</code>), <code>purpose</code>, <code>check_in</code>, <code>check_out</code>. Open visit ⇒ <code>check_out IS NULL</code></td>
</tr>
<tr>
<td><code>employee_accounts</code></td>
<td>Staff logins — <code>username</code> (unique), <code>password_hash</code> (salted scrypt), <code>full_name</code>, <code>title</code>, contact fields, <code>profile_image</code></td>
</tr>
<tr>
<td><code>books</code></td>
<td>Catalog &amp; inventory — bibliographic details, <code>copies</code>, subjects, call/accession numbers, acquisition metadata</td>
</tr>
</table>

---

## 🔌 API Reference

> Base path `/api`. All routes require `Authorization: Bearer <token>` **except** `/auth/login`, `/auth/logout`, and `/books`.

<details>
<summary><b>🔑 Auth — <code>/api/auth</code></b></summary>

<br />

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/login` | Authenticate; returns token + employee |
| `GET` | `/session` | Validate token, return current employee |
| `GET` | `/profile` | Load employee profile |
| `PUT` | `/profile` | Update profile (requires current password) |
| `POST` | `/profile-image` | Upload / replace profile photo |
| `POST` | `/logout` | Client-side session end |

</details>

<details open>
<summary><b>🕒 Attendance — <code>/api/attendance</code></b> <i>(auth required)</i></summary>

<br />

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/kiosk/summary` | Today's totals + hourly buckets + recent activity |
| `GET` | `/kiosk/student/:studentId` | Kiosk lookup with check-in state |
| `POST` | `/kiosk/check-in` | Kiosk check-in (purpose required) |
| `POST` | `/kiosk/check-out` | Kiosk check-out |
| `POST` | `/kiosk/scan` | Single-scan auto toggle (in ↔ out) |
| `POST` | `/checkin` | Admin check-in |
| `POST` | `/checkout/:id` | Manual check-out of one record |
| `GET` | `/active` | Everyone currently inside |
| `GET` | `/tracker` | Filtered records + summary counts |
| `GET` | `/export` | Full activity export |

</details>

<details>
<summary><b>📚 Other routes</b></summary>

<br />

- `/api/students` *(auth)* — CRUD, search, profile images, profiles with recent activity
- `/api/stats` *(auth)* — dashboard chart + summary data
- `/api/books` *(public)* — book catalog and inventory

</details>

---

## 🔐 Authentication &amp; Security

Staff-only authentication protects both the admin console and the kiosk.

```text
1. Staff log in with username + password
2. Checked against employee_accounts — passwords are salted scrypt hashes,
   compared in constant time
3. Server issues a stateless HMAC-SHA256 token (payload.signature), TTL 12h
4. Frontend sends it as a Bearer header; requireEmployeeAuth rejects any
   missing, tampered, or expired token
```

> [!IMPORTANT]
> The signing secret comes from `AUTH_SECRET`. If unset, it is derived from configured credentials — **always set `AUTH_SECRET` explicitly in production.**

The backend auto-creates and seeds `employee_accounts` on first run. A local dev fallback account exists **only** when no employee is configured and `NODE_ENV` is not `production`.

---

## 💻 Local Setup

**Requirements** — Node.js 20.x · npm · MySQL (or a TiDB-compatible database)

```bash
# 1 — install
npm install                # frontend deps (project root)
cd backend && npm install  # backend deps

# 2 — run (from project root)
npm run dev                # frontend + backend together
```

<details>
<summary><b>Environment variables</b></summary>

<br />

**Frontend** — `.env` at root:
```env
REACT_APP_API_URL=http://localhost:3001/api
```

**Backend** — `backend/.env`:
```env
PORT=3001
CLIENT_ORIGIN=http://localhost:3000
AUTH_SECRET=generate_a_long_random_string

EMPLOYEE_USERNAME=librarian
EMPLOYEE_PASSWORD=change_me

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=library_attendance

FILE_STORAGE=local
```

</details>

---

## 🚀 Deployment

Deployed as **two Vercel projects** — a static React build from the repo root, and the Express API from `backend/`.

| Project | Notes |
|---------|-------|
| **Frontend** | Create React App · build `npm run build` → `build` · root `vercel.json` rewrites all paths to `index.html` |
| **Backend** | Express via `backend/api/index.js` · Node 20.x · rewrites in `backend/vercel.json` |

<details>
<summary><b>Production environment variables</b></summary>

<br />

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

</details>

> **Why TiDB Cloud** — MySQL-compatible, so the existing schema and queries run unchanged.
> **Why Cloudinary** — Vercel's filesystem is ephemeral; uploaded images must live in external storage.

---

## 🗂️ Project Structure

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
│   ├── routes/                 # auth · attendance · students · stats · books
│   ├── database/schema-production.sql
│   └── server.js               # app assembly, CORS, route mounting
├── database/                   # schema variants
├── public/
├── src/
│   ├── components/
│   ├── pages/                  # Login · Dashboard · AttendanceMonitoring · …
│   ├── layouts/  ·  context/   # AuthContext
│   └── services/api.js
└── package.json
```

---

## 🛡️ Security Notes &amp; Roadmap

Findings from the internal audit of the attendance and auth subsystems, ordered by priority. The check-in engine itself is **sound** — transactional row-locking, parameterized queries, timezone-safe, dual-mode cutoff. These are the areas to harden next.

| Priority | Item | Why it matters |
|:--------:|------|----------------|
| 🔴 | **Audit trail** | `attendance_logs` records the student and times but not *which employee* performed each action. Add an actor column or audit table so every check-in / checkout / edit is attributable. |
| 🔴 | **Login rate limiting** | `POST /api/auth/login` is unthrottled — add lockout to resist brute-force. |
| 🟠 | **Sanitize 500 responses** | `/active`, `/tracker`, `/checkout/:id`, `/export` return raw DB errors; replace with generic messages and log internally. |
| 🟠 | **Guard `POST /checkout/:id`** | Verify the visit is still open before writing `check_out`, so re-posting can't overwrite a completed record. |
| 🟡 | **Confirm `/api/books` policy** | The only unauthenticated data route — gate it if the catalog isn't meant to be public. |
| 🟡 | **Lock down CORS** | When `CLIENT_ORIGIN` is unset the API accepts all origins; require an explicit allowlist in production. |
| 🟡 | **Token revocation** | Tokens are stateless and valid until expiry; consider short TTL + refresh or a server-side denylist. |

---

<div align="center">

<sub>Built for real school-library operations — attendance recorded by students at the kiosk,<br />fully managed and monitored by authorized library staff.</sub>

<br /><br />

**Goa Community College Library** · Made with care 🤍

</div>
