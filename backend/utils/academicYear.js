/**
 * Academic year helpers shared by archive admin workflow and snapshot builder.
 */

function deriveAcademicYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 8) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

/** Parse "2025/2026" → start year 2025 */
function parseAcademicYearStart(academicYear) {
  const match = /^(\d{4})\/(\d{4})$/.exec(String(academicYear || '').trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return start;
}

/**
 * Dynamic academic year list: past, current, and future options.
 * @param {Date} [baseDate]
 * @param {number} [pastCount] years before current
 * @param {number} [futureCount] years after current
 */
function generateAcademicYearOptions(baseDate = new Date(), pastCount = 3, futureCount = 2) {
  const currentStart = parseAcademicYearStart(deriveAcademicYear(baseDate));
  if (currentStart == null) return [];
  const options = [];
  for (let offset = -pastCount; offset <= futureCount; offset += 1) {
    const start = currentStart + offset;
    options.push(`${start}/${start + 1}`);
  }
  return options;
}

const SEMESTER_OPTIONS = [
  { value: 'first', label: 'First Semester' },
  { value: 'second', label: 'Second Semester' },
];

const SEMESTER_LABELS = {
  first: 'First Semester',
  second: 'Second Semester',
};

function semesterLabel(semester) {
  return SEMESTER_LABELS[semester] || semester;
}

module.exports = {
  deriveAcademicYear,
  parseAcademicYearStart,
  generateAcademicYearOptions,
  SEMESTER_OPTIONS,
  SEMESTER_LABELS,
  semesterLabel,
};
