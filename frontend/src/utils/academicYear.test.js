import {
  deriveAcademicYear,
  generateAcademicYearOptions,
  isDuplicateArchive,
  semesterLabel,
} from './academicYear';

describe('academicYear utils', () => {
  test('deriveAcademicYear before and after August', () => {
    expect(deriveAcademicYear(new Date('2026-03-01'))).toBe('2025/2026');
    expect(deriveAcademicYear(new Date('2026-09-01'))).toBe('2026/2027');
  });

  test('generateAcademicYearOptions includes past and future years', () => {
    const options = generateAcademicYearOptions(new Date('2026-03-01'), 2, 2);
    expect(options).toContain('2025/2026');
    expect(options).toContain('2023/2024');
    expect(options).toContain('2027/2028');
    expect(options.length).toBeGreaterThan(3);
  });

  test('isDuplicateArchive detects existing archive', () => {
    const existing = [{ academicYear: '2025/2026', semester: 'first' }];
    expect(isDuplicateArchive(existing, '2025/2026', 'first')).toBe(true);
    expect(isDuplicateArchive(existing, '2025/2026', 'second')).toBe(false);
    expect(isDuplicateArchive(existing, '2024/2025', 'first')).toBe(false);
  });

  test('semesterLabel', () => {
    expect(semesterLabel('first')).toBe('First Semester');
    expect(semesterLabel('second')).toBe('Second Semester');
  });
});
