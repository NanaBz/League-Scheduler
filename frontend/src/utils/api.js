import axios from 'axios';

// Prefer explicit env; fall back by NODE_ENV (local dev → localhost)
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://league-scheduler.onrender.com/api'
    : 'http://localhost:5001/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
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

/** Turn axios errors into readable messages (handles HTML 404 bodies from Express). */
export function parseApiErrorMessage(err, fallback = 'Request failed.') {
  const data = err.response?.data;
  const status = err.response?.status;

  if (data && typeof data === 'object' && data.message) {
    return data.message;
  }

  if (typeof data === 'string') {
    const preMatch = data.match(/<pre>([^<]+)<\/pre>/i);
    const raw = (preMatch ? preMatch[1] : data).trim();
    if (/cannot (PUT|GET|POST|PATCH|DELETE)\s+\/api\//i.test(raw)) {
      return (
        'This fantasy feature is not on the server you are connected to yet. ' +
        'For local testing use REACT_APP_API_URL=http://localhost:5001/api with the latest backend running. ' +
        'For production, redeploy the backend on Render.'
      );
    }
    if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html')) {
      if (status === 404) {
        return (
          'API route not found on this server. Deploy the latest backend or switch to your local API ' +
          '(REACT_APP_API_URL=http://localhost:5001/api).'
        );
      }
      return fallback;
    }
    if (raw) return raw;
  }

  if (status === 404) {
    return (
      'API route not found. Deploy the latest backend or use REACT_APP_API_URL=http://localhost:5001/api locally.'
    );
  }
  if (status === 401) return 'Your session expired. Sign out and sign in again.';
  if (status) return `${fallback} (HTTP ${status})`;
  return `${fallback} Check your connection and that the backend is running.`;
}

export default api;
