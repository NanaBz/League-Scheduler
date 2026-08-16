import React from 'react';
import './OverallLeague.css';

export default function OverallLeague({ entries, lastUpdated, onRowClick, hideLastUpdated, emptyMessage, errorMessage }) {
  const data = Array.isArray(entries) ? entries : [];
  const updated = lastUpdated || new Date().toLocaleString();
  const emptyText =
    emptyMessage ||
    'No fantasy managers registered yet. Teams appear here automatically when accounts are created.';

  return (
    <div className={`overall-league${hideLastUpdated ? ' ol-no-meta' : ''}`}>
      {!hideLastUpdated && (
        <div className="ol-header">
          <span className="ol-updated">Last updated: {updated}</span>
        </div>
      )}

      <div className="ol-table-wrap">
        <table className="ol-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>GW</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {errorMessage ? (
              <tr>
                <td colSpan={4} className="ol-empty ol-empty--error">
                  {errorMessage}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="ol-empty">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.fantasyUserId || `${row.team}-${row.user}`}
                  className="ol-row"
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  <td className="ol-pos">
                    {row.pos != null ? (
                      <span className={`ol-pos-badge ${row.delta ?? 'same'}`}>{row.pos}</span>
                    ) : (
                      <span className="ol-pos-placeholder" title="Ranks appear once points are live">
                        —
                      </span>
                    )}
                  </td>
                  <td className="ol-team">
                    <div className="ol-team-line">
                      <span className="ol-team-name">{row.team}</span>
                      {row.pos != null ? (
                        <span className="ol-delta" aria-hidden>
                          {row.delta === 'up' ? '▲' : row.delta === 'down' ? '▼' : '–'}
                        </span>
                      ) : null}
                    </div>
                    <div className="ol-user-sub">{row.user}</div>
                  </td>
                  <td className="ol-gw">{row.gw}</td>
                  <td className="ol-total">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
