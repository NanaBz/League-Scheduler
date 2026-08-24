import React from 'react';

export function getTeamLogoClass(teamName) {
  const baseClass = 'team-logo';
  const teamClass = `${String(teamName || '').toLowerCase()}-logo`;
  return `${baseClass} ${teamClass}`;
}

export function formatArchiveDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function formatArchiveStage(stage, competitionId) {
  if (!stage || stage === 'regular') return '';
  if (competitionId === 'super-cup') return 'FINAL';
  switch (String(stage).toLowerCase()) {
    case 'final':
      return 'FINAL';
    case 'semi-final':
    case 'semifinal':
      return 'SEMI-FINAL';
    default:
      return String(stage).toUpperCase();
  }
}

export function renderForm(form) {
  if (!form || form.length === 0) return <span className="no-form">-</span>;
  return (
    <div className="form-display">
      {form.map((result, index) => (
        <span
          key={index}
          className={`form-result ${String(result).toLowerCase()}`}
          title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
        >
          {result}
        </span>
      ))}
    </div>
  );
}
