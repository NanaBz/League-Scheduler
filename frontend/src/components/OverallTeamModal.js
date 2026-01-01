import React from 'react';

export default function OverallTeamModal({ team, onClose, onOpenPlayerManagement }) {
  if (!team) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{team.team}</h3>
        <p style={{ marginTop: 4, color: '#6b7280' }}>{team.user}</p>
        <div style={{ display:'flex', gap:'1rem', marginTop:'0.75rem' }}>
          <div><strong>GW:</strong> {team.gw}</div>
          <div><strong>Total:</strong> {team.total}</div>
        </div>
        <hr style={{ margin:'1rem 0', opacity:0.2 }} />
        <div>
          <h4 style={{ marginBottom: '0.5rem' }}>Squad</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.5rem' }}>
            {team.players?.map((p, idx) => (
              <div key={`${p.id}-${idx}`} style={{ display:'flex', justifyContent:'space-between', background:'#f9fafb', padding:'0.5rem 0.75rem', borderRadius:8 }}>
                <span>{p.name}</span>
                <span style={{ color:'#6b7280' }}>{p.position}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>Close</button>
          {onOpenPlayerManagement && (
            <button className="btn" onClick={() => onOpenPlayerManagement(team)}>Open in Player Management</button>
          )}
        </div>
      </div>
    </div>
  );
}
