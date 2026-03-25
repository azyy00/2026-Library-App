# Library Management System Setup Guide

## Prerequisites
- Node.js (v20 recommended)
- MySQL Server
- Git

## Database Setup

1. **Install MySQL** (if not already installed)
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP for easy setup

2. **Create Database**
   ```sql
   -- Run the schema.sql file in your MySQL client
   -- Or copy and paste the contents of database/schema.sql
   ```

3. **Create backend environment variables**
   - Copy `backend/.env.example` to `backend/.env`
   - Update these values for your local MySQL server:
     ```env
     DB_HOST=localhost
     DB_PORT=3306
     DB_USER=root
     DB_PASSWORD=
     DB_NAME=library_attendance
     ```

## Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the backend server**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

   The backend will run on `http://localhost:3001`

## Frontend Setup

1. **Navigate to project root**
   ```bash
   cd ..  # (if you're in the backend directory)
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the frontend**
   ```bash
   npm start
   ```

   The frontend will run on `http://localhost:3000`

## Development Mode (Both servers)

To run both frontend and backend simultaneously:

```bash
npm run dev
```

This will start both servers using concurrently.

## Deploy To Vercel

This project is easiest to deploy on Vercel as **two Vercel projects**:

1. A frontend project from the repository root
2. A backend project from the `backend` folder

That matches the codebase structure today: React handles the UI and Express handles the API and MySQL access.

### Why two Vercel projects?

- The frontend is a Create React App build that outputs static files
- The backend is an Express API that runs as a Vercel Function
- Student profile images should use Cloudinary in production because Vercel does not provide permanent local file storage for uploads

### Fastest database option

For the least setup work, use a **MySQL-compatible online database** instead of rewriting the backend.

- Recommended: **TiDB Cloud Serverless**
- Why: it is MySQL-compatible and has a native Vercel Marketplace integration
- The backend already accepts either the existing `DB_*` variables or TiDB's `TIDB_*` variables

### Frontend Vercel project

1. Import the repository into Vercel
2. Set the **Root Directory** to the repository root
3. Confirm these settings:
   ```text
   Framework Preset: Create React App
   Build Command: npm run build
   Output Directory: build
   Node.js Version: 20.x
   ```
4. Add this environment variable:
   ```text
   REACT_APP_API_URL=https://your-backend-project.vercel.app/api
   ```
5. Deploy

### Frontend notes

- The root `vercel.json` rewrites all non-file routes to `index.html`, so React Router pages like `/attendance` and `/active` still load on refresh
- The sample frontend API URL is also in `.env.example`

### Backend Vercel project

1. Create a second Vercel project from the same repository
2. Set the **Root Directory** to:
   ```text
   backend
   ```
3. Confirm these settings:
   ```text
   Framework Preset: Other
   Install Command: npm install
   Build Command: leave empty
   Output Directory: leave empty
   Node.js Version: 20.x
   ```
4. Add these environment variables in Vercel:
   ```env
   CLIENT_ORIGIN=https://your-frontend-project.vercel.app

   DB_HOST=your-mysql-host
   DB_PORT=25060
   DB_USER=your-mysql-user
   DB_PASSWORD=your-mysql-password
   DB_NAME=defaultdb
   DB_SSL=true
   DB_SSL_REJECT_UNAUTHORIZED=false
   DB_CONNECTION_LIMIT=10

   FILE_STORAGE=cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   CLOUDINARY_FOLDER=library-app/profiles
   ```
5. Deploy

### TiDB Cloud shortcut

If you use **TiDB Cloud for Vercel**, Vercel can inject these variables for you:

```env
TIDB_HOST=your-host
TIDB_PORT=4000
TIDB_USER=your-user
TIDB_PASSWORD=your-password
TIDB_DATABASE=your-database
```

For TiDB Cloud public endpoints, keep TLS enabled:

```env
TIDB_ENABLE_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### Backend notes

- `backend/vercel.json` rewrites incoming requests to the Vercel Function entry at `backend/api/index.js`
- `backend/server.js` now exports the Express app for Vercel and only starts `app.listen(...)` during local development
- The attendance cutoff interval scheduler is not started on Vercel, but the same auto-checkout sweep still runs before every `/api` request
- If Cloudinary credentials are missing on Vercel, profile image uploads will return a clear error instead of trying to write to a temporary filesystem

### Suggested deployment flow

1. Create an online MySQL database and import `database/schema-managed.sql`
2. Create a Cloudinary account for student profile images
3. Deploy the backend Vercel project from `backend`
4. Copy the backend deployment URL and set it as `REACT_APP_API_URL` in the frontend project
5. Deploy or redeploy the frontend Vercel project

## Features

### ✅ Completed Features
- Student Registration
- Attendance Check-in/Check-out
- Dashboard with Statistics
- Active Visitors Management
- Responsive UI with Bootstrap

### 🎯 Key Components
- **Dashboard**: Overview of library statistics
- **Student Registration**: Add new students to the system
- **Attendance Log**: Check students in/out
- **Active Visitors**: Manage currently checked-in students

### 🔧 API Endpoints
- `GET /api/students` - Get all students
- `POST /api/students` - Register new student
- `GET /api/students/search?q=query` - Search students
- `POST /api/attendance/checkin` - Check in student
- `POST /api/attendance/checkout/:id` - Check out student
- `GET /api/attendance/active` - Get active visitors
- `GET /api/stats` - Get dashboard statistics

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure MySQL is running
   - Check database credentials in `backend/config/db.js`
   - Verify database `library_attendance` exists

2. **Port Already in Use**
   - Backend runs on port 3001
   - Frontend runs on port 3000
   - Change ports in respective configuration files if needed

3. **CORS Issues**
   - Set `CLIENT_ORIGIN` to your frontend Vercel URL
   - You can also provide multiple origins separated by commas
   - If issues persist, check browser console for errors

### Testing the System

1. Start both servers
2. Open `http://localhost:3000`
3. Register a new student
4. Check in the student
5. View active visitors
6. Check out the student
7. Check dashboard for updated statistics

## Next Steps

- Add user authentication
- Implement data validation
- Add more detailed reporting
- Export functionality
- Email notifications
