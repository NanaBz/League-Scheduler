import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

export default function AdminEventsModal({ match, onClose, onSaved }) {
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [events, setEvents] = useState(match.events || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const [homeRes, awayRes] = await Promise.all([
          api.get(`/players`, { params: { teamId: match.homeTeam._id || match.homeTeam } }),
          api.get(`/players`, { params: { teamId: match.awayTeam._id || match.awayTeam } }),
        ]);
        setHomePlayers(homeRes.data || []);
        setAwayPlayers(awayRes.data || []);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      }
    };
    run();
  }, [match]);

  const allPlayersBySide = useMemo(() => ({
    home: homePlayers,
    away: awayPlayers,
  }), [homePlayers, awayPlayers]);

  const addEvent = (type) => {
    const base = { type, side: 'home', player: '', minute: '' };
    if (type === 'GOAL') {
      setEvents(prev => [...prev, { ...base, ownGoal: false, assistPlayer: '' }]);
    } else {
      setEvents(prev => [...prev, base]);
    }
  };

  const updateEvent = (idx, patch) => {
    setEvents(prev => prev.map((ev, i) => i === idx ? { ...ev, ...patch } : ev));
  };

  const removeEvent = (idx) => {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Basic validation
      for (const ev of events) {
        if (!ev.type || !ev.side || !ev.player) throw new Error('Each event must have type, side and player');
      }
      await api.post(`/matches/${match._id}/events`, { events: events.map(ev => ({
        type: ev.type,
        side: ev.side,
        player: ev.player,
        assistPlayer: ev.assistPlayer || undefined,
        ownGoal: !!ev.ownGoal,
        minute: ev.minute ? parseInt(ev.minute) : undefined,
      })) });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderPlayerOptions = (side) => (
    (allPlayersBySide[side] || []).map(p => (
      <option key={p._id} value={p._id}>{p.number ? `${p.number} - ` : ''}{p.name}</option>
    ))
  );

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 900 }}>
        <h3>Record Match Events</h3>
        <p>
          {match.homeTeam.name} vs {match.awayTeam.name}
          {match.matchweek ? ` • MW ${match.matchweek}` : ''}
          {match.competition ? ` • ${match.competition}` : ''}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-success btn-small" onClick={() => addEvent('GOAL')}>Add Goal</button>
          <button className="btn btn-warning btn-small" onClick={() => addEvent('YELLOW_CARD')}>Add Yellow Card</button>
          <button className="btn btn-danger btn-small" onClick={() => addEvent('RED_CARD')}>Add Red Card</button>
          <button className="btn btn-info btn-small" onClick={() => addEvent('CLEAN_SHEET')}>Add Clean Sheet</button>
        </div>

        <div className="table" style={{ width: '100%', display: 'grid', gridTemplateColumns: '100px 120px 1fr 1fr 120px 80px 80px', gap: 8, alignItems: 'center' }}>
          <div><strong>Type</strong></div>
          <div><strong>Side</strong></div>
          <div><strong>Player</strong></div>
          <div><strong>Assist</strong></div>
          <div><strong>Own Goal</strong></div>
          <div><strong>Minute</strong></div>
          <div></div>
          {events.map((ev, idx) => (
            <React.Fragment key={idx}>
              <select className="input" value={ev.type} onChange={e => updateEvent(idx, { type: e.target.value })}>
                <option value="GOAL">GOAL</option>
                <option value="YELLOW_CARD">YELLOW_CARD</option>
                <option value="RED_CARD">RED_CARD</option>
                <option value="CLEAN_SHEET">CLEAN_SHEET</option>
              </select>
              <select className="input" value={ev.side} onChange={e => updateEvent(idx, { side: e.target.value, player: '', assistPlayer: '' })}>
                <option value="home">home</option>
                <option value="away">away</option>
              </select>
              <select className="input" value={ev.player} onChange={e => updateEvent(idx, { player: e.target.value })}>
                <option value="">Select player</option>
                {renderPlayerOptions(ev.side)}
              </select>
              {ev.type === 'GOAL' ? (
                <select className="input" value={ev.assistPlayer || ''} onChange={e => updateEvent(idx, { assistPlayer: e.target.value })}>
                  <option value="">No assist</option>
                  {renderPlayerOptions(ev.side)}
                </select>
              ) : (
                <div style={{ color: '#999' }}>—</div>
              )}
              {ev.type === 'GOAL' ? (
                <input type="checkbox" checked={!!ev.ownGoal} onChange={e => updateEvent(idx, { ownGoal: e.target.checked })} />
              ) : (
                <div style={{ color: '#999' }}>—</div>
              )}
              <input className="input" type="number" min="0" max="120" value={ev.minute || ''} onChange={e => updateEvent(idx, { minute: e.target.value })} placeholder="min" />
              <button className="btn btn-secondary btn-small" onClick={() => removeEvent(idx)}>Remove</button>
            </React.Fragment>
          ))}
        </div>

        {error && <div className="error-inline" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-success" onClick={save} disabled={saving}> {saving ? 'Saving…' : 'Save Events'} </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
