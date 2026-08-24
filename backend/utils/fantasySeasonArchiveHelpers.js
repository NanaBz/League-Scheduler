const mongoose = require('mongoose');

function rankEntriesForArchive(entries) {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || b.gw - a.gw || a.team.localeCompare(b.team)
  );
  return sorted.map((row, index) => ({
    ...row,
    pos: index + 1,
  }));
}

/** Build immutable manager-season rows from live overall-league entries. */
function buildManagerSeasonResultDocs(entries, { seasonNumber, seasonName, archivedAt = new Date() }) {
  const ranked = rankEntriesForArchive(entries);
  const totalManagers = ranked.length;

  return ranked.map((entry) => ({
    fantasyUserId: new mongoose.Types.ObjectId(entry.fantasyUserId),
    teamName: entry.team,
    managerName: entry.user,
    seasonNumber,
    seasonName,
    finalPoints: entry.total,
    finalRank: entry.pos,
    totalManagers,
    archivedAt,
  }));
}

module.exports = {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
};
