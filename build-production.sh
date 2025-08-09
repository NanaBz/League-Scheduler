#!/bin/bash

echo "🚀 Building League Scheduler for Production..."

# Build frontend
echo "📱 Building React frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Production build complete!"
echo "📦 Frontend build ready in ./frontend/build"
echo "🌐 Ready for deployment to Vercel"

echo ""
echo "Next steps:"
echo "1. Deploy backend to Railway"
echo "2. Deploy frontend to Vercel"  
echo "3. Update environment variables"
echo "4. Test production deployment"
