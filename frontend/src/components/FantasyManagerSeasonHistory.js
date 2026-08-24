import React from 'react';
import { formatPercentRankLabel, historyRowKey } from '../utils/fantasyManagerHistory';
import './FantasyManagerProfile.css';

function HistoryCards({ rows }) {
  return (
    <div className="fmp-history-cards" aria-label="Season history cards">
      {rows.map((row) => (
        <article key={historyRowKey(row)} className="fmp-history-card">
          <div className="fmp-history-card__season">{row.seasonName || `Season ${row.seasonNumber}`}</div>
          <dl className="fmp-history-card__stats">
            <div>
              <dt>Points</dt>
              <dd>{row.finalPoints ?? 0}</dd>
            </div>
            <div>
              <dt>Rank</dt>
              <dd>{row.finalRank ?? '—'}</dd>
            </div>
            <div>
              <dt>% Rank</dt>
              <dd>{row.percentRankLabel || formatPercentRankLabel(row.percentRank)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function HistoryTable({ rows }) {
  return (
    <div className="fmp-history-table-wrap">
      <table className="fmp-history-table">
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Points</th>
            <th scope="col">Rank</th>
            <th scope="col">% Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={historyRowKey(row)}>
              <td className="fmp-history-table__season">{row.seasonName || `Season ${row.seasonNumber}`}</td>
              <td className="fmp-history-table__num">{row.finalPoints ?? 0}</td>
              <td className="fmp-history-table__num">{row.finalRank ?? '—'}</td>
              <td className="fmp-history-table__num">
                {row.percentRankLabel || formatPercentRankLabel(row.percentRank)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FantasyManagerSeasonHistory({ history, loading, error }) {
  if (loading) {
    return <p className="fmp-message fmp-message--muted">Loading season history…</p>;
  }

  if (error) {
    return <p className="fmp-message fmp-message--error">{error}</p>;
  }

  if (!Array.isArray(history) || history.length === 0) {
    return (
      <p className="fmp-message fmp-message--muted">
        No completed FPL seasons yet. Your overall league results will appear here after a season is archived.
      </p>
    );
  }

  return (
    <>
      <HistoryTable rows={history} />
      <HistoryCards rows={history} />
    </>
  );
}
