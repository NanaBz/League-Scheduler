import React from 'react';
import './OverallLeague.css';

// Minimal, prop-driven table. If no data is passed, uses mock entries.
export default function OverallLeague({ entries, lastUpdated, onRowClick }) {
  const data = entries && entries.length ? entries : [
    { pos: 1, team: '2 šeško 4 your girl', user: 'Ehizoba Humphrey', gw: 38, total: 1110, delta: 'up' },
    { pos: 2, team: 'your papa', user: 'Akerejola Ayomide', gw: 26, total: 1105, delta: 'down' },
    { pos: 3, team: 'Eden F.C', user: 'Daniel Larsen-Reindorf', gw: 42, total: 1082, delta: 'up' },
    { pos: 4, team: 'nD$;/', user: 'Benedict Abrahams', gw: 38, total: 1080, delta: 'down' },
  ];

  const updated = lastUpdated || new Date().toLocaleString();

  return (
    <div className="overall-league">
      <div className="ol-header">
        <span className="ol-updated">Last updated: {updated}</span>
      </div>

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
            {data.map((row) => (
              <tr key={`${row.pos}-${row.team}`} className="ol-row" onClick={() => onRowClick && onRowClick(row)}>
                <td className="ol-pos">
                  <span className={`ol-pos-badge ${row.delta ?? 'same'}`}>{row.pos}</span>
                </td>
                <td className="ol-team">
                  <div className="ol-team-line">
                    <span className="ol-team-name">{row.team}</span>
                    <span className="ol-delta" aria-hidden>
                      {row.delta === 'up' ? '▲' : row.delta === 'down' ? '▼' : '–'}
                    </span>
                  </div>
                  <div className="ol-user-sub">{row.user}</div>
                </td>
                <td className="ol-gw">{row.gw}</td>
                <td className="ol-total">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
