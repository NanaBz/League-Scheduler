@echo off
echo ================================================================
echo     LEAGUE SCHEDULER - TESTING EXISTING BACKEND
echo ================================================================
echo.

echo 🔍 Backend is running on port 5001 ✅
echo.

echo 🎯 Testing Randomized Circle Method Generation...
echo Making API call to generate fixtures (Run 1)...
curl -s -X POST http://localhost:5001/api/matches/generate-league
echo.
echo Making API call to generate fixtures (Run 2)...
curl -s -X POST http://localhost:5001/api/matches/generate-league
echo.
echo Making API call to generate fixtures (Run 3)...
curl -s -X POST http://localhost:5001/api/matches/generate-league
echo.
echo.

echo 🔍 Verifying Generated Fixtures...
cd backend
node verify-fixtures.js

echo.
echo ================================================================
echo                 TESTING COMPLETE!
echo ================================================================
echo.
echo 🌐 You can also visit:
echo    - Backend API: http://localhost:5001/api/teams
echo    - Generate via browser: http://localhost:5001/api/matches/generate-league
echo.
echo 🎨 To start frontend, run: start-frontend-only.bat
echo.
pause
