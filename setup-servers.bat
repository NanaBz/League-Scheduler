@echo off
echo ================================================================
echo          LEAGUE SCHEDULER - CIRCLE METHOD SETUP
echo ================================================================
echo.

echo 🧹 Cleaning up existing processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 🚀 Starting Backend Server...
start "Backend Server" cmd /k "cd /d \"%~dp0backend\" && echo Backend Starting... && node server.js"

echo ⏱️  Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo 🎨 Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d \"%~dp0frontend\" && echo Frontend Starting... && npm start"

echo ⏱️  Waiting for frontend to start...
timeout /t 3 /nobreak >nul

echo ✅ Both servers should now be running!
echo.
echo 📡 Backend:  http://localhost:5001
echo 🌐 Frontend: http://localhost:3000
echo.
echo 🎯 Test the Circle Method by visiting the frontend admin panel
echo    or using: Invoke-RestMethod -Uri "http://localhost:5001/api/matches/generate-league" -Method Post
echo.
pause
