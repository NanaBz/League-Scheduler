@echo off
echo ================================================================
echo     TESTING CIRCLE METHOD ALGORITHM - LEAGUE SCHEDULER
echo ================================================================
echo.

echo 🔍 Testing Backend Connection...
curl -s http://localhost:5001/api/teams >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Backend is running on port 5001
) else (
    echo ❌ Backend is not responding
    echo 💡 Please run setup-servers.bat first
    pause
    exit
)

echo.
echo 🎯 Generating Circle Method Fixtures...
curl -X POST http://localhost:5001/api/matches/generate-league

echo.
echo 🔍 Verifying Fixtures...
cd backend
node verify-fixtures.js

echo.
echo ================================================================
echo                    TESTING COMPLETE!
echo ================================================================
pause
