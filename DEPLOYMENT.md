# Deployment Guide

## Overview
This guide covers deploying the League Scheduler application with:
- **Frontend**: Vercel (React app)
- **Backend**: Railway (Node.js/Express API)
- **Database**: MongoDB Atlas

## Prerequisites
- GitHub account with your repository pushed
- Vercel account
- Railway account
- MongoDB Atlas account

## Step 1: Database Setup (MongoDB Atlas)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for free account

2. **Create Cluster**
   - Choose "Shared" (free tier)
   - Select AWS/Google Cloud
   - Choose nearest region
   - Name your cluster (e.g., "league-scheduler")

3. **Set up Database Access**
   - Go to "Database Access"
   - Add new database user
   - Choose "Password" authentication
   - Save username/password securely
   - Grant "Read and write to any database"

4. **Set up Network Access**
   - Go to "Network Access"
   - Add IP Address
   - Choose "Allow access from anywhere" (0.0.0.0/0)
   - Or add specific IP addresses for security

5. **Get Connection String**
   - Go to "Clusters"
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password

## Step 2: Backend Deployment (Railway)

1. **Create Railway Account**
   - Go to [Railway](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your League-Scheduler repository
   - Choose the `backend` folder as root

3. **Set Environment Variables**
   - Go to your project dashboard
   - Click on "Variables"
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=5001
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/league-scheduler
     JWT_SECRET=your-super-secure-jwt-secret-256-bit
     ADMIN_EMAIL=nboakyeakyeampong@gmail.com
     ```

4. **Generate Strong JWT Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Deploy**
   - Railway will automatically deploy
   - Note your backend URL (e.g., `https://your-app.railway.app`)

## Step 3: Frontend Deployment (Vercel)

1. **Create Vercel Account**
   - Go to [Vercel](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "New Project"
   - Import your GitHub repository
   - Choose the `frontend` folder as root

3. **Set Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add:
     ```
     REACT_APP_API_URL=https://your-backend.railway.app/api
     REACT_APP_ENV=production
     ```

4. **Deploy**
   - Vercel will build and deploy automatically
   - Your frontend will be available at `https://your-app.vercel.app`

## Step 4: Final Configuration

1. **Update CORS in Backend**
   - The backend is already configured to accept your Vercel domain
   - It will automatically allow your frontend URL

2. **Test Deployment**
   - Visit your Vercel URL
   - Test league tables, matches, and admin authentication
   - Verify admin login with your email

3. **SSL Certificate**
   - Both Vercel and Railway provide automatic HTTPS
   - Your app will be secure by default

## Step 5: Admin First Login

1. **Access Admin Panel**
   - Go to your deployed frontend
   - Click "Admin" in the footer
   - Enter your email: `nboakyeakyeampong@gmail.com`

2. **Set Strong Password**
   - Create a password with:
     - At least 8 characters
     - Uppercase and lowercase letters
     - Numbers and special characters

## Environment Variables Reference

### Frontend (.env)
```
REACT_APP_API_URL=https://your-backend.railway.app/api
REACT_APP_ENV=production
```

### Backend (.env)
```
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/league-scheduler
JWT_SECRET=your-super-secure-jwt-secret
ADMIN_EMAIL=nboakyeakyeampong@gmail.com
```

## Security Checklist

- ✅ HTTPS enabled (automatic with Vercel/Railway)
- ✅ JWT secret is cryptographically secure
- ✅ Admin email whitelist enforced
- ✅ Password hashing with bcrypt
- ✅ CORS properly configured
- ✅ Database credentials secured
- ✅ Environment variables not in code

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify frontend URL is in backend CORS configuration
   - Check environment variables are set correctly

2. **Database Connection**
   - Verify MongoDB Atlas connection string
   - Check network access settings
   - Ensure database user has correct permissions

3. **Authentication Issues**
   - Verify JWT secret is set
   - Check admin email in environment variables
   - Ensure HTTPS is working

### Support

If you encounter issues:
1. Check application logs in Railway/Vercel dashboards
2. Verify all environment variables are set
3. Test API endpoints directly
4. Check database connectivity

## Cost Estimation

- **MongoDB Atlas**: Free (512MB)
- **Railway**: $5/month (if exceeding free tier)
- **Vercel**: Free (for personal projects)
- **Total**: $0-5/month

## Maintenance

- Regular database backups (Atlas handles this)
- Monitor application performance
- Keep dependencies updated
- Review security logs periodically
