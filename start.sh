#!/bin/bash

echo "🚀 Starting League Scheduler Application..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    echo "   - For local: mongod"
    echo "   - For service: sudo systemctl start mongod"
    exit 1
fi

# Start backend in background
echo "📦 Starting backend server..."
cd backend
npm install > /dev/null 2>&1
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🌐 Starting frontend server..."
cd ../frontend
npm install > /dev/null 2>&1
npm start &
FRONTEND_PID=$!

echo "✅ Application started successfully!"
echo "🔗 Frontend: http://localhost:3000"
echo "🔗 Backend:  http://localhost:5000"
echo ""
echo "📝 To stop the application:"
echo "   kill $BACKEND_PID $FRONTEND_PID"

# Wait for user to stop
wait
