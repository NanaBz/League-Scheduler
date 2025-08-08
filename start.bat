@echo off
echo 🚀 Starting League Scheduler Application...

echo 📦 Starting backend server...
start "Backend" cmd /k "cd backend && npm install && npm run dev"

timeout /t 3 /nobreak > nul

echo 🌐 Starting frontend server...
start "Frontend" cmd /k "cd frontend && npm install && npm start"

echo ✅ Application started successfully!
echo 🔗 Frontend: http://localhost:3000
echo 🔗 Backend:  http://localhost:5000
echo.
echo Press any key to exit...
pause > nul
