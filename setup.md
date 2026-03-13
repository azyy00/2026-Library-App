# Library Management System Setup Guide

## Prerequisites
- Node.js (v14 or higher)
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

3. **Update Database Configuration**
   - Edit `backend/config/db.js`
   - Update the connection details if needed:
     ```javascript
     const connection = mysql.createConnection({
         host: 'localhost',
         user: 'root',           // Your MySQL username
         password: '',           // Your MySQL password
         database: 'library_attendance'
     });
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

## Frontend Deployment On Vercel

Use this option when the frontend should be hosted on Vercel while the backend stays on a separate Node host.

### Requirements
- A public backend URL, for example `https://your-backend-domain.example`
- The backend must expose the API under `/api`
- The backend must allow requests from your Vercel frontend domain

### Vercel Settings

1. Import this project into Vercel
2. Set the project root to the repository root:
   ```text
   library-app-main
   ```
3. Confirm these build settings:
   ```text
   Framework Preset: Create React App
   Build Command: npm run build
   Output Directory: build
   Node.js Version: 20.x
   ```
4. Add this environment variable in Vercel:
   ```text
   REACT_APP_API_URL=https://your-backend-domain.example/api
   ```
5. Deploy the project

### Notes
- `vercel.json` includes a rewrite so React Router routes like `/attendance` and `/active` work on refresh
- Uploaded student profile images are still served from the backend host, not Vercel
- The sample value is also available in `.env.example`

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
   - Backend has CORS enabled for all origins
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
