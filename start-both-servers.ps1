# Start Backend Server
Write-Host "🚀 Starting Backend Server..." -ForegroundColor Green
Start-Process PowerShell -ArgumentList '-NoExit', '-Command', 'cd "c:\Users\ThinkPad\Desktop\NBA repositories\League-Scheduler\backend"; Write-Host "Backend Server Starting..." -ForegroundColor Green; node server.js'

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend Server  
Write-Host "🎨 Starting Frontend Server..." -ForegroundColor Blue
Start-Process PowerShell -ArgumentList '-NoExit', '-Command', 'cd "c:\Users\ThinkPad\Desktop\NBA repositories\League-Scheduler\frontend"; Write-Host "Frontend Server Starting..." -ForegroundColor Blue; npm start'

Write-Host "✅ Both servers should be starting in separate windows!" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow

# Keep this window open
Read-Host "Press Enter to exit"
