import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

export default function GirlsTeamsPage() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // No need to fetch teams here, handled by parent

  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true); setError(null);
    Promise.all([
      api.get('/players', { params: { teamId: selectedTeam._id } }),
      api.get('/stats', { params: { team: selectedTeam._id } })
    ])
      .then(([playersRes, statsRes]) => {
        setPlayers(playersRes.data);
        setStats(statsRes.data || []);
      })
      .catch(() => setError('Failed to load roster'))
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  const grouped = useMemo(() => {
    const g = { GK: [], DF: [], MF: [], ATT: [] };
    for (const p of players) { if (g[p.position]) g[p.position].push(p); }
    return g;
  }, [players]);

  const captain = useMemo(() => players.find(p => p.isCaptain), [players]);
  const viceCaptain = useMemo(() => players.find(p => p.isViceCaptain), [players]);
  const topScorer = useMemo(() => {
    if (stats.length === 0) return null;
    return stats.reduce((max, s) => (s.goals || 0) > (max.goals || 0) ? s : max, stats[0]);
  }, [stats]);
  const topAssister = useMemo(() => {
    if (stats.length === 0) return null;
    return stats.reduce((max, s) => (s.assists || 0) > (max.assists || 0) ? s : max, stats[0]);
  }, [stats]);

  return (
    <div className="teams-page">

      {selectedTeam && (
        <div className="team-detail" style={{ background: '#f8fafc', borderRadius: 12, padding: 12, color: '#1e293b' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedTeam.logo && (
              <img src={selectedTeam.logo} alt={selectedTeam.name}
                style={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  borderRadius: 8,
                  background: selectedTeam.name === 'Falcons' ? '#94a3b8' : '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}
              />
            )}
            {selectedTeam.name}
          </h3>
          {loading && <div className="loading-inline">Loading squad…</div>}
          {error && <div className="error-inline">{error}</div>}
          {!loading && !error && (
            <>
              {/* Team Info */}
              <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid #ddd' }}>
                {selectedTeam.staff && selectedTeam.staff.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <strong>Coaches:</strong>
                    <ul style={{ margin: '5px 0 0 20px', fontSize: '0.95em' }}>
                      {selectedTeam.staff.map((s, idx) => (
                        <li key={idx}>{s.name} ({s.role})</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <strong>Captain:</strong> {captain ? captain.name : 'N/A'}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Vice Captain:</strong> {viceCaptain ? viceCaptain.name : 'N/A'}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Top Scorer:</strong> {topScorer ? `${topScorer.player?.name || 'Unknown'} (${topScorer.goals || 0})` : 'N/A'}
                </div>
                <div>
                  <strong>Top Assister:</strong> {topAssister ? `${topAssister.player?.name || 'Unknown'} (${topAssister.assists || 0})` : 'N/A'}
                </div>
              </div>

              {/* Squad List */}
              <h4 style={{ marginTop: 20, marginBottom: 10 }}>Squad</h4>
              <div className="squad-groups">
                {['GK','DF','MF','ATT'].map(pos => (
                  <div key={pos} className={`squad-group squad-${pos}`}>
                    <div className="group-title">{pos}</div>
                    <ul>
                      {grouped[pos].map(p => (
                        <li key={p._id} className="player-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="shirt-number">{p.number ?? '-'}</span>
                            <span className="player-name" style={{ color: '#1e293b', fontWeight: 500 }}>{p.name}</span>
                          </div>
                          <div style={{ fontSize: '0.85em', color: '#666' }}>
                            {p.isCaptain && <span style={{ marginRight: 6, fontWeight: 'bold', color: '#d97706' }}>C</span>}
                            {p.isViceCaptain && <span style={{ fontWeight: 'bold', color: '#059669' }}>VC</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
