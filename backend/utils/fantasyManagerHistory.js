/**
 * Historical % Rank from archived season snapshot values only.
 * ((totalManagers - rank) / totalManagers) * 100, one decimal place.
 */
function calculateHistoricalPercentRank(finalRank, totalManagers) {
  const rank = Number(finalRank);
  const total = Number(totalManagers);

  if (!Number.isFinite(rank) || !Number.isFinite(total) || total <= 0 || rank <= 0) {
    return null;
  }

  const value = ((total - rank) / total) * 100;
  return Math.round(value * 10) / 10;
}

function formatHistoricalPercentRank(finalRank, totalManagers) {
  const value = calculateHistoricalPercentRank(finalRank, totalManagers);
  if (value == null) return null;
  return `${value.toFixed(1)}%`;
}

function mapHistoryRow(doc) {
  const finalRank = doc.finalRank;
  const totalManagers = doc.totalManagers;
  const percentRank = calculateHistoricalPercentRank(finalRank, totalManagers);

  return {
    seasonNumber: doc.seasonNumber,
    seasonName: doc.seasonName,
    teamName: doc.teamName,
    managerName: doc.managerName,
    finalPoints: doc.finalPoints ?? 0,
    finalRank,
    totalManagers,
    percentRank,
    percentRankLabel: percentRank == null ? null : `${percentRank.toFixed(1)}%`,
    archivedAt: doc.archivedAt,
  };
}

module.exports = {
  calculateHistoricalPercentRank,
  formatHistoricalPercentRank,
  mapHistoryRow,
};
