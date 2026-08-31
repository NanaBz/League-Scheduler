import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../utils/api';
import './AdminActivityLog.css';

const PAGE_SIZE = 50;

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detailLine(entry) {
  const d = entry.details || {};
  if (entry.action === 'player_price_updated' && d.playerName) {
    const oldP = d.oldPrice != null ? Number(d.oldPrice).toFixed(1) : '?';
    const newP = d.newPrice != null ? Number(d.newPrice).toFixed(1) : '?';
    return `${d.playerName} · AC ${oldP}m → AC ${newP}m`;
  }
  if (d.playerName) return d.playerName;
  if (d.teamName) return d.teamName;
  if (d.competition) return String(d.competition);
  if (d.matchweek != null) return `Matchweek ${d.matchweek}`;
  if (d.seasonNumber != null) return `Season ${d.seasonNumber}`;
  if (d.academicYear && d.semester) return `${d.academicYear} · ${d.semester}`;
  return null;
}

export default function AdminActivityLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async (nextSkip, append) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/activity', {
        params: { limit: PAGE_SIZE, skip: nextSkip },
      });
      if (!data?.success) throw new Error(data?.message || 'Could not load activity log');
      const rows = data.entries || [];
      setTotal(data.total ?? rows.length);
      setSkip(nextSkip + rows.length);
      setEntries((prev) => (append ? [...prev, ...rows] : rows));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load activity log');
      if (!append) setEntries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const canLoadMore = entries.length < total;

  return (
    <div className="admin-activity-log admin-shell-section">
      <header className="admin-page-header">
        <div>
          <h2>Activity Log</h2>
          <p className="admin-page-subtitle">
            Recent admin actions across fixtures, players, and fantasy management.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary admin-activity-refresh"
          onClick={() => fetchPage(0, false)}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden />
          Refresh
        </button>
      </header>

      {error ? <p className="admin-activity-error" role="alert">{error}</p> : null}

      {loading ? (
        <p className="admin-activity-empty">Loading activity…</p>
      ) : entries.length === 0 ? (
        <p className="admin-activity-empty">No admin activity recorded yet.</p>
      ) : (
        <ul className="admin-activity-list">
          {entries.map((entry) => {
            const meta = detailLine(entry);
            return (
              <li key={entry.id} className="admin-activity-item">
                <div className="admin-activity-item__main">
                  <span className="admin-activity-item__line">{entry.displayLine}</span>
                  {meta ? <span className="admin-activity-item__meta">{meta}</span> : null}
                </div>
                <time className="admin-activity-item__time" dateTime={entry.createdAt}>
                  {formatWhen(entry.createdAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && canLoadMore ? (
        <div className="admin-activity-more">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fetchPage(skip, true)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
