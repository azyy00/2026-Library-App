@echo off
echo Installing Library Management System...
echo.

echo Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo Backend installation failed!
    pause
    exit /b 1
)

echo.
echo Installing frontend dependencies...
cd ..
call npm install
if %errorlevel% neq 0 (
    echo Frontend installation failed!
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
echo.
echo Next steps:
echo 1. Set up MySQL database (see setup.md)
echo 2. Run: npm run dev (to start both servers)
echo 3. Open http://localhost:3000 in your browser
echo.
pause
