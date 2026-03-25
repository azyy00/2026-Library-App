# GCC Library Attendance Monitoring System

A web-based library attendance system for Goa Community College that supports:

- employee-only administration
- student attendance monitoring through a separate kiosk-style page
- student registration
- attendance check-in and check-out
- dashboard statistics and attendance tracking
- profile image uploads

The system is built as a two-part application:

- a React frontend for the user interface
- an Express backend for authentication, student records, attendance, and reporting

## 1. System Overview

This project is designed for two main users:

- `Library employees / admins`
  - log in to the protected admin system
  - manage students
  - monitor attendance
  - view dashboard analytics
  - update the admin profile and credentials

- `Students`
  - use the separate attendance monitoring page
  - search by student ID
  - check in or check out
  - register first if not yet in the student record

The student monitoring page writes attendance directly into the same database used by the admin dashboard, so the admin side always reflects the latest student activity.

## 2. Main Features

### Admin side
- Employee login with protected routes
- Dashboard with total visits, active visitors, purpose distribution, course distribution, and trends
- Student registration and editing
- Student profile viewing
- Attendance tracker and active visitor management
- Admin profile update for username, password, and account details

### Student monitoring side
- Separate kiosk-style attendance interface
- Student ID lookup
- Explicit `Check in` and `Check out` actions
- Purpose selection during check-in
- Hourly check-in count
- Separate student registration page for students not yet encoded

## 3. Tools and Technologies Used

### Frontend
- `React 18`
- `React Router DOM`
- `Axios`
- `Bootstrap 5`
- `Chart.js`
- `react-chartjs-2`
- `xlsx`
- `file-saver`

### Backend
- `Node.js 20`
- `Express`
- `mysql2`
- `cors`
- `dotenv`
- `multer`
- native Node `crypto` for employee auth token signing and password hashing

### Database and storage
- `TiDB Cloud`
  - used in production as the online MySQL-compatible database
- `MySQL`
  - supported for local development
- `Cloudinary`
  - used in production for student profile image storage

### Deployment and development tools
- `Vercel`
  - frontend hosting
  - backend serverless hosting
- `Git` and `GitHub`
- `Nodemon`
- `concurrently`

## 4. Architecture

```text
Students/Admins
      |
      v
React Frontend (Vercel)
      |
      v
Express API (Vercel)
      |
      +--> TiDB Cloud / MySQL database
      |
      +--> Cloudinary image storage
```

### Why it was deployed this way

The system was deployed as `two Vercel projects`:

1. `Frontend project`
   - deployed from the repository root
   - serves the React application

2. `Backend project`
   - deployed from the `backend` application
   - runs the Express API

This structure is the best fit for the current codebase because:

- the frontend is a static React build
- the backend is an API server
- the database and image storage are external services
- Vercel does not provide permanent local storage for uploaded files

## 5. How the System Was Deployed

### Production deployment flow

1. The `frontend` was deployed to Vercel from the project root.
2. The `backend` was deployed to Vercel from the `backend` app.
3. The database was moved online using `TiDB Cloud`.
4. Student image uploads were moved to `Cloudinary`.
5. Environment variables were added in Vercel for:
   - API connection
   - CORS
   - TiDB connection
   - Cloudinary credentials
   - employee login seed

### Frontend deployment

- Framework: `Create React App`
- Build command: `npm run build`
- Output directory: `build`
- Routing support: handled by root `vercel.json`, which rewrites all paths to `index.html`

Frontend environment variable:

```env
REACT_APP_API_URL=https://your-backend-project.vercel.app/api
```

### Backend deployment

- Platform: `Vercel`
- Runtime style: `Express` app exposed through `backend/api/index.js`
- Node version: `20.x`
- Rewrites handled by `backend/vercel.json`

Backend environment variables commonly used:

```env
CLIENT_ORIGIN=https://your-frontend-project.vercel.app

EMPLOYEE_USERNAME=librarian
EMPLOYEE_PASSWORD=change_me
EMPLOYEE_NAME=GCC Library Staff
EMPLOYEE_TITLE=Library Administrator

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=library_attendance

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

### Why TiDB Cloud was used

TiDB Cloud was used for the faster deployment path because it is MySQL-compatible, so the existing backend queries and schema could remain in place without rewriting the system to a different database model.

### Why Cloudinary was used

Cloudinary was used because uploaded profile images should not be stored on Vercel's temporary filesystem in production.

## 6. Database Design

The core production schema uses three main tables:

### `students`
Stores student identity and profile data.

Main fields:
- `student_id`
- `first_name`
- `last_name`
- `middle_name`
- `address`
- `email`
- `gender`
- `course`
- `year_level`
- `section`
- `profile_image`

### `attendance_logs`
Stores each library visit.

Main fields:
- `student_id` (linked to the student record)
- `purpose`
- `check_in`
- `check_out`

### `employee_accounts`
Stores employee login accounts.

Main fields:
- `username`
- `password_hash`
- `full_name`
- `title`
- `email`
- `phone_number`
- `profile_note`

## 7. Backend Overview

The backend is organized into configuration modules and route modules.

### Entry point

- `backend/server.js`
  - creates the Express app
  - applies CORS and JSON middleware
  - mounts all API routes
  - exports the app for Vercel
  - starts a local server only when running outside Vercel

### Backend configuration modules

- `backend/config/db.js`
  - creates the MySQL/TiDB connection pool
  - supports both `DB_*` and `TIDB_*` environment variables
  - supports SSL for cloud database connections

- `backend/config/auth.js`
  - manages employee login
  - seeds the first employee account from environment variables
  - hashes passwords
  - creates and validates auth tokens
  - protects admin-only routes

- `backend/config/storage.js`
  - manages file storage strategy
  - uses local upload storage in development
  - uses Cloudinary in production

- `backend/config/attendanceCutoff.js`
  - handles attendance cutoff logic
  - auto-checks out open visits after the cutoff time

- `backend/config/manilaTime.js`
  - standardizes time handling in Asia/Manila
  - keeps attendance durations and timestamps aligned with local library time

### Backend route modules

- `backend/routes/authRoutes.js`
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `GET /api/auth/profile`
  - `PUT /api/auth/profile`
  - `POST /api/auth/logout`

- `backend/routes/studentRoutes.js`
  - create, edit, delete, and search students
  - upload or replace profile images
  - return full student profiles with recent activity

- `backend/routes/attendanceRoutes.js`
  - admin attendance check-in and check-out
  - active attendance list
  - tracker records and export
  - kiosk summary
  - kiosk student lookup
  - kiosk check-in and kiosk check-out

- `backend/routes/statsRoutes.js`
  - returns dashboard statistics for charts and summary cards

## 8. Authentication Flow

The system uses employee-only authentication for the admin side.

### How it works

1. Employee logs in with username and password.
2. Backend verifies the credentials against `employee_accounts`.
3. Backend returns an auth token.
4. Frontend stores and sends that token in protected API requests.
5. Protected admin routes reject requests without a valid token.

### Notes

- In local development, a fallback development account can be used if no configured employee is present.
- In production, the system uses the stored employee account table.
- The monitoring page is also protected, so only authorized staff can open the kiosk page.

## 9. Frontend Pages

Main pages in the frontend:

- `LoginPage`
  - employee login

- `Dashboard`
  - admin overview and analytics

- `AdminProfilePage`
  - admin account update page

- `AttendanceMonitoringPage`
  - kiosk-style student attendance interface

- `MonitoringRegistrationPage`
  - separate registration page used from the kiosk flow

## 10. Key System Behaviors

### Attendance monitoring behavior

- When a student is looked up in the kiosk page:
  - if not currently inside, the system allows `Check in`
  - if already inside, the system allows `Check out`

### Hourly check-in count

The hourly count is based on the `check_in` time of each attendance record. If one student checks in at `1:00 PM`, the `1:00 PM` row increases by `1`. If another checks in at `2:00 PM`, the `2:00 PM` row increases by `1`.

### Attendance cutoff

The system supports a library cutoff time. New check-ins are blocked after cutoff, while open visits can be auto-closed by the backend logic.

## 11. Local Setup

### Requirements

- `Node.js 20.x`
- `npm`
- `MySQL` or TiDB-compatible database

### Install

From the project root:

```bash
npm install
cd backend
npm install
```

### Environment setup

Frontend:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

Backend:

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:3000
EMPLOYEE_USERNAME=librarian
EMPLOYEE_PASSWORD=change_me
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=library_attendance
FILE_STORAGE=local
```

### Run locally

Frontend only:

```bash
npm start
```

Backend only:

```bash
cd backend
npm run dev
```

Both together from root:

```bash
npm run dev
```

## 12. Project Structure

```text
2026-Library-App/
|-- backend/
|   |-- api/
|   |-- config/
|   |-- database/
|   |-- routes/
|   |-- server.js
|   |-- vercel.json
|-- database/
|   |-- schema-production.sql
|-- public/
|-- src/
|   |-- components/
|   |-- layouts/
|   |-- pages/
|   |-- services/
|-- package.json
|-- setup.md
|-- vercel.json
```

## 13. Summary

This project is a complete library attendance and monitoring system with:

- a protected admin application
- a separate student attendance kiosk
- online cloud deployment
- cloud image storage
- online database storage
- student registration and attendance tracking
- reporting and monitoring features for library staff

It is suited for real school library operations where attendance must be recorded by students while still being monitored and managed securely by authorized library employees.
