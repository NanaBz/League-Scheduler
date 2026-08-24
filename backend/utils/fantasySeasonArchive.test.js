const assert = require('assert');
const {
  rankEntriesForArchive,
  buildManagerSeasonResultDocs,
} = require('./fantasySeasonArchive');

function run() {
  const entries = [
    { fantasyUserId: 'aaaaaaaaaaaaaaaaaaaaaaaa', team: 'Alpha FC', user: 'Alice', total: 120, gw: 10, pos: null },
    { fantasyUserId: 'bbbbbbbbbbbbbbbbbbbbbbbb', team: 'Beta FC', user: 'Bob', total: 150, gw: 8, pos: null },
    { fantasyUserId: 'cccccccccccccccccccccccc', team: 'Gamma FC', user: 'Gina', total: 150, gw: 12, pos: null },
  ];

  const ranked = rankEntriesForArchive(entries);
  assert.strictEqual(ranked[0].fantasyUserId, 'cccccccccccccccccccccccc');
  assert.strictEqual(ranked[0].pos, 1);
  assert.strictEqual(ranked[1].fantasyUserId, 'bbbbbbbbbbbbbbbbbbbbbbbb');
  assert.strictEqual(ranked[1].pos, 2);
  assert.strictEqual(ranked[2].pos, 3);

  const archivedAt = new Date('2026-08-24T00:00:00.000Z');
  const docs = buildManagerSeasonResultDocs(entries, {
    seasonNumber: 3,
    seasonName: 'Season 3',
    archivedAt,
  });

  assert.strictEqual(docs.length, 3);
  assert.strictEqual(docs[0].finalRank, 1);
  assert.strictEqual(docs[0].finalPoints, 150);
  assert.strictEqual(docs[0].teamName, 'Gamma FC');
  assert.strictEqual(docs[0].managerName, 'Gina');
  assert.strictEqual(docs[0].seasonNumber, 3);
  assert.strictEqual(docs[0].seasonName, 'Season 3');
  assert.strictEqual(docs[0].totalManagers, 3);
  assert.strictEqual(docs[0].archivedAt.toISOString(), archivedAt.toISOString());

  const docsById = new Map(docs.map((doc) => [String(doc.fantasyUserId), doc]));
  assert.strictEqual(docsById.get('aaaaaaaaaaaaaaaaaaaaaaaa').finalRank, 3);
  assert.strictEqual(docsById.get('aaaaaaaaaaaaaaaaaaaaaaaa').finalPoints, 120);

  console.log('fantasySeasonArchive tests passed');
}

run();
