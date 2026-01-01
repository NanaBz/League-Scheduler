## ⚠️ Security Notice

**Never commit secrets or credentials to the repository.**

- All secrets (MongoDB URIs, JWT secrets, SMTP credentials, etc.) must be stored in `.env` files and never pushed to GitHub.
- The `.env` files are now gitignored.
- If secrets were ever committed, rotate them immediately and clean your git history (see below).

### If you exposed secrets:
1. **Rotate/revoke** all exposed credentials (MongoDB, JWT, SMTP, etc.).
2. **Purge secrets from git history** using [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-branch`.
3. **Force-push** the cleaned history to GitHub.
4. **Update Vercel/Render/hosted env vars** with new secrets.
5. **Check GitHub security alerts** for any remaining exposures.
# League Scheduler

A comprehensive web application for managing a school's football league system with MongoDB + Express backend and React frontend.

## Screenshots

### Desktop View
![League Table](screenshots/desktop-league-table.png)
![Fixtures](screenshots/desktop-fixtures.png)
![Admin Panel](screenshots/desktop-admin-panel.png)

### Mobile View
![Mobile League Table](screenshots/mobile-league-table.png)
![Mobile Fixtures](screenshots/mobile-fixtures.png)

## Features

### Admin Panel
- **Secure Authentication**: Email whitelist with strong password requirements
- **Set League Fixtures**: Generate home and away fixtures for 6 teams (10 matchweeks total)
- **Set Cup Fixtures**: Create knockout tournament for top 4 teams (semifinals and final)
- **Set Super Cup Fixture**: League winner vs cup winner
- **Edit Matches**: Update scores, dates, and times for all matches
- **Reset Season**: Clear all data and start fresh
- **Session Management**: JWT-based authentication with automatic logout

### Security Features
- **Email Whitelist**: Only authorized admins can access admin panel
- **Password Hashing**: bcryptjs encryption for secure password storage
- **JWT Tokens**: Secure session management with expiration
- **CORS Protection**: Production-ready CORS configuration

### User View
- **League Table**: Real-time standings with points, goals, and statistics
- **Fixtures & Results**: View all matches with filtering options
- **Winner Banners**: Congratulatory messages when competitions are won

### Mobile Features
- **Responsive Design**: Mobile-first responsive design with bottom navigation
- **Mobile League Table**: Card-based layout optimized for touch interaction
- **Mobile Fixtures & Results**: Clean card layout for matches with easy-to-read information
- **Mobile Cup Matches**: Organized by tournament stages (Semi-Finals, Final) with penalty shootout display
- **Mobile Super Cup**: Special purple gradient card design for the ultimate championship showdown
- **Mobile Archived Seasons**: Complete mobile responsiveness for viewing historical season data with card-based league tables and match results
- **Touch-Friendly Navigation**: Bottom navigation bar with competition tabs
- **Mobile Admin Access**: Full admin functionality accessible on mobile devices

## Technology Stack

- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: React, Axios
- **Database**: MongoDB
- **Authentication**: JWT tokens, bcryptjs password hashing
- **Security**: Email whitelist, CORS protection

## 🚀 Quick Deployment

**Live Demo**: [Your deployed app URL here]

For full deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

### Production Stack
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: MongoDB Atlas
- **Cost**: Free tier available

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd League-Scheduler
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your MongoDB connection string
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Initialize Data**
   - Go to Admin Panel
   - Click "Initialize Teams" to create default teams
   - Click "Set League Fixtures" to generate the league schedule
   - Click "Set Cup Fixtures" to create cup matches

## API Endpoints

### Teams
- `GET /api/teams` - Get all teams with league table data
- `POST /api/teams` - Create a new team
- `POST /api/teams/initialize` - Initialize default teams

### Matches
- `GET /api/matches` - Get matches (with filtering)
- `POST /api/matches` - Create a new match
- `PUT /api/matches/:id` - Update match details
- `POST /api/matches/generate-league` - Generate league fixtures
- `POST /api/matches/generate-cup` - Generate cup fixtures

### Competitions
- `GET /api/competitions` - Get competition data
- `POST /api/competitions/reset-season` - Reset all data
- `POST /api/competitions/check-winners` - Check and update winners

## League System

- **6 Teams**: Dragons, Vikings, Warriors, Lions, Elites, Falcons
- **League**: Double round-robin (home and away)
- **Cup**: Top 4 teams in knockout format
- **Super Cup**: League winner vs Cup winner

## Development

### Backend Development
```bash
cd backend
npm run dev  # Starts with nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm start  # Starts development server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License
