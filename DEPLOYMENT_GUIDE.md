# League Scheduler - Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Railway account (for backend)
- MongoDB Atlas account (for database)

## Step 1: Database Setup (MongoDB Atlas)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/atlas
   - Sign up for a free account
   - Create a new cluster (M0 Sandbox - Free tier)

2. **Database Configuration**
   - Cluster Name: `league-scheduler`
   - Database Name: `league-scheduler`
   - Collection: Will be created automatically

3. **Security Setup**
   - Create a database user with read/write permissions
   - Add your IP address to IP whitelist (or 0.0.0.0/0 for all IPs)
   - Get your connection string: `mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE`

## Step 2: Backend Deployment (Railway)

1. **Connect to Railway**
   - Go to https://railway.app
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your League-Scheduler repository
   - Choose the backend folder

2. **Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE
   JWT_SECRET=your-super-strong-jwt-secret-minimum-32-characters
   NODE_ENV=production
   ADMIN_EMAIL=your-admin-email@example.com
   PORT=5000
   FRONTEND_URL=https://your-app-name.vercel.app
   ```

3. **Generate JWT Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Deployment Settings**
   - Root Directory: `/backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

5. **Get Railway URL**
   - After deployment, copy your Railway app URL
   - Format: `https://your-app-name.railway.app`

## Step 3: Frontend Deployment (Vercel)

1. **Connect to Vercel**
   - Go to https://vercel.com
   - Sign up with GitHub
   - Click "New Project"
   - Import your League-Scheduler repository
   - Choose the frontend folder

2. **Build Settings**
   - Framework Preset: Create React App
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`

3. **Environment Variables**
   ```
   REACT_APP_API_URL=https://your-backend-app.railway.app/api
   REACT_APP_ENV=production
   ```

4. **Custom Domain (Optional)**
   - Add your custom domain in Vercel settings
   - Update FRONTEND_URL in Railway environment variables

## Step 4: Final Configuration

1. **Update CORS Settings**
   - Update FRONTEND_URL in Railway with your actual Vercel URL
   - Redeploy backend if needed

2. **Test Deployment**
   - Visit your Vercel app URL
   - Test all functionality:
     - View leagues and competitions
     - Mobile responsiveness
     - Admin authentication with your email
     - Data persistence

3. **Admin Setup**
   - Go to your deployed app
   - Click "Admin" in the footer
   - Enter: your-admin-email@example.com
   - Set up your secure password

## Environment Variables Summary

### Backend (Railway)
```
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE
JWT_SECRET=your-32-char-secret
NODE_ENV=production
ADMIN_EMAIL=your-admin-email@example.com
PORT=5000
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (Vercel)
```
REACT_APP_API_URL=https://your-backend.railway.app/api
REACT_APP_ENV=production
```

## Security Checklist

✅ Strong JWT secret (32+ characters)
✅ CORS configured for production domain only
✅ Admin email whitelist active
✅ MongoDB Atlas IP whitelist configured
✅ Environment variables set correctly
✅ HTTPS enabled on both frontend and backend

## Monitoring & Maintenance

- **Railway**: Monitor backend logs and performance
- **Vercel**: Check build logs and deployment status
- **MongoDB Atlas**: Monitor database usage and performance
- **Uptime**: Set up monitoring tools like UptimeRobot

## Troubleshooting

1. **CORS Errors**: Check FRONTEND_URL matches exactly
2. **Database Connection**: Verify MongoDB URI and IP whitelist
3. **Authentication Issues**: Check JWT_SECRET and ADMIN_EMAIL
4. **Build Failures**: Check environment variables and dependencies

## Costs

- **MongoDB Atlas**: Free (M0 tier - 512MB)
- **Railway**: Free tier available, $5/month for production
- **Vercel**: Free for personal projects
- **Total**: $0-5/month depending on usage
