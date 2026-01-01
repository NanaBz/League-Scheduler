import axios from 'axios';

// Force production API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://league-scheduler.onrender.com/api'
  : process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Attach the right token depending on route
    const url = config.url || '';
    const isFantasyAdminRoute = url.includes('/fantasy/admin/');
    const isFantasyUserRoute = !isFantasyAdminRoute && url.includes('/fantasy/');
    
    if (!config.headers.Authorization) {
      if (isFantasyAdminRoute) {
        // Fantasy admin endpoints require admin token
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        }
      } else if (isFantasyUserRoute) {
        // User-facing fantasy endpoints use fantasy token
        const fantasyToken = localStorage.getItem('fantasyToken');
        if (fantasyToken) {
          config.headers.Authorization = `Bearer ${fantasyToken}`;
        }
      } else {
        // Default to admin token for other admin routes
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);


// Fantasy Leagues API
export async function fetchUserLeagues() {
  const res = await api.get('/fantasy/leagues');
  return res.data.leagues;
}

export async function createLeague(name) {
  const res = await api.post('/fantasy/leagues', { name });
  return res.data.league;
}

export async function joinLeague(leagueId) {
  const res = await api.post('/fantasy/leagues/join', { leagueId });
  return res.data.league;
}

export async function leaveLeague(leagueId) {
  const res = await api.post('/fantasy/leagues/leave', { leagueId });
  return res.data.success;
}

export default api;
