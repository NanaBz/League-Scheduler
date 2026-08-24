const assert = require('assert');
const {
  deriveAcademicYear,
  generateAcademicYearOptions,
  parseAcademicYearStart,
} = require('./academicYear');
const { validateArchiveRequest } = require('./seasonReset');

function run() {
  assert.strictEqual(deriveAcademicYear(new Date('2026-03-01')), '2025/2026');
  assert.strictEqual(deriveAcademicYear(new Date('2026-09-01')), '2026/2027');
  assert.strictEqual(parseAcademicYearStart('2025/2026'), 2025);
  assert.strictEqual(parseAcademicYearStart('2025/2027'), null);

  const options = generateAcademicYearOptions(new Date('2026-03-01'), 2, 1);
  assert.ok(options.includes('2025/2026'));
  assert.ok(options.includes('2023/2024'));
  assert.ok(options.includes('2026/2027'));
  assert.strictEqual(options.length, 4);

  let v = validateArchiveRequest({ academicYear: '', semester: 'first' });
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.code, 'missing_academic_year');

  v = validateArchiveRequest({ academicYear: '2025/2026', semester: '' });
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.code, 'missing_semester');

  v = validateArchiveRequest({ academicYear: '2025/2026', semester: 'first' });
  assert.strictEqual(v.ok, true);

  v = validateArchiveRequest({ academicYear: 'bad', semester: 'first' });
  assert.strictEqual(v.code, 'invalid_academic_year');

  v = validateArchiveRequest({ academicYear: '2025/2026', semester: 'full' });
  assert.strictEqual(v.code, 'invalid_semester');

  // resetLiveSeasonData contract: never deletes Player or Team documents (only stats/fixtures)
  const resetSource = require('fs').readFileSync(require('path').join(__dirname, 'seasonReset.js'), 'utf8');
  assert.ok(!resetSource.includes('Player.deleteMany'), 'reset must not delete player rosters');
  assert.ok(!resetSource.includes('Team.deleteMany'), 'reset must not delete teams');
  assert.ok(resetSource.includes('rollbackFantasySeasonArchive'), 'unified reset must roll back FPL archive');
  assert.ok(resetSource.includes('resetFantasySeasonData'), 'unified reset must coordinate FPL reset');

  console.log('academicYear + seasonReset validation tests passed');
}

run();
