/** Client-side academic year helpers (mirrors backend/utils/academicYear.js). */

export function deriveAcademicYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 8) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

function parseAcademicYearStart(academicYear) {
  const match = /^(\d{4})\/(\d{4})$/.exec(String(academicYear || '').trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return start;
}

export function generateAcademicYearOptions(baseDate = new Date(), pastCount = 3, futureCount = 2) {
  const currentStart = parseAcademicYearStart(deriveAcademicYear(baseDate));
  if (currentStart == null) return [];
  const options = [];
  for (let offset = -pastCount; offset <= futureCount; offset += 1) {
    const start = currentStart + offset;
    options.push(`${start}/${start + 1}`);
  }
  return options;
}

export const SEMESTER_OPTIONS = [
  { value: 'first', label: 'First Semester' },
  { value: 'second', label: 'Second Semester' },
];

export const SEMESTER_LABELS = {
  first: 'First Semester',
  second: 'Second Semester',
};

export function semesterLabel(semester) {
  return SEMESTER_LABELS[semester] || semester;
}

export function isDuplicateArchive(existingArchives, academicYear, semester) {
  if (!academicYear || !semester) return false;
  return (existingArchives || []).some(
    (row) => row.academicYear === academicYear && row.semester === semester
  );
}
