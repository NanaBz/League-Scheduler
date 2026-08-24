export function formatPercentRankLabel(percentRank) {
  if (percentRank == null || Number.isNaN(Number(percentRank))) return '—';
  return `${Number(percentRank).toFixed(1)}%`;
}

export function historyRowKey(row) {
  return `${row.seasonNumber}-${row.finalRank}-${row.finalPoints}`;
}
