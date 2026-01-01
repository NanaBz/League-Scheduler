import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import './FantasyDashboard.css';

function formatDeadline(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2,'0');
  const mins = d.getMinutes().toString().padStart(2,'0');
  return `${day} ${date} ${month} at ${hours}:${mins}`;
}

function toDate(dateStr, timeStr) {
  try {
    const d = new Date(dateStr);
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d;
  } catch {
    return null;
  }
}

export default function FantasyDashboardCard({ user, onPickTeam, onTransfers, onLeaguesCups }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all published matches; compute next matchweek deadline (1h before first match of that week)
  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/matches');
        setMatches(Array.isArray(data) ? data : []);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const upcomingInfo = useMemo(() => {
    const now = new Date();
    // Find earliest upcoming matchweek number with any future match
    const future = matches
      .map(m => ({ ...m, dt: toDate(m.date, m.time) }))
      .filter(m => m.dt && m.dt.getTime() > now.getTime());
    if (future.length === 0) return { week: null, deadline: null };
    const nextWeek = Math.min(...future.map(m => m.matchweek || 0).filter(Boolean));
    const inWeek = future.filter(m => (m.matchweek || 0) === nextWeek);
    if (inWeek.length === 0) return { week: nextWeek, deadline: null };
    const earliest = inWeek.reduce((a,b) => (a.dt < b.dt ? a : b));
    const deadline = new Date(earliest.dt.getTime() - 60 * 60 * 1000); // 1 hour before
    return { week: nextWeek, deadline };
  }, [matches]);

  const initials = useMemo(() => {
    const name = user?.teamName || 'Team';
    const parts = name.trim().split(/\s+/);
    const letters = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
    return letters || 'TT';
  }, [user]);

  // Placeholder metrics until scoring endpoints exist
  const averagePoints = 0;
  const userPoints = 0;
  const highestPoints = 0;

  return (
    <div className="fantasy-card">
      <div className="top-row">
        <div className="user-block">
          <div className="avatar">{initials}</div>
          <div className="names">
            <div className="team">{user?.teamName || 'Your Team'}</div>
            <div className="manager">{user?.managerName || 'Manager'}</div>
          </div>
        </div>
        {/* Right arrow hint (visual only) */}
        <div aria-hidden style={{ fontWeight: 900, fontSize: 18, opacity: 0.9 }}>→</div>
      </div>

      <div className="divider" />

      <div className="gw-header">
        {loading ? 'Loading gameweek…' : (
          upcomingInfo.week ? `Gameweek ${upcomingInfo.week}` : 'Gameweek —'
        )}
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="label">Average</div>
          <div className="value">{Math.round(averagePoints)}</div>
        </div>
        <div className="metric clickable" role="button" onClick={() => { /* future: open points breakdown */ }}>
          <div className="label">Points →</div>
          <div className="value">{Math.round(userPoints)}</div>
        </div>
        <div className="metric clickable" role="button" onClick={() => { /* future: open highest details */ }}>
          <div className="label">Highest →</div>
          <div className="value">{Math.round(highestPoints)}</div>
        </div>
      </div>

      <div className="deadline" style={{ marginTop: 14 }}>
        <div className="title">{`Gameweek ${upcomingInfo.week || '—'} Deadline`}</div>
        <div className="time">
          {upcomingInfo.deadline ? formatDeadline(upcomingInfo.deadline) : '—'}
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>(1 hour before first match)</div>
      </div>

      <div className="actions">
        <button className="btn-pill white" onClick={onPickTeam}>Pick Team</button>
        <button className="btn-pill dark" onClick={onTransfers}>Transfers</button>
      </div>
    </div>
  );
}
