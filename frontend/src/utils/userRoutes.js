export const USER_SECTIONS = ['fixtures', 'stats', 'teams', 'fantasy', 'archived'];

export const SECTION_TO_PATH = {
  fixtures: '/fixtures',
  stats: '/stats',
  teams: '/teams',
  fantasy: '/fantasy',
  archived: '/archived',
};

export const PATH_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_TO_PATH).map(([section, path]) => [path, section])
);

export function pathToSection(pathname) {
  const normalized = (pathname || '').replace(/\/$/, '') || '/';
  if (normalized === '/archived' || normalized.startsWith('/archived/')) {
    return 'archived';
  }
  return PATH_TO_SECTION[normalized] || null;
}

export function savedSectionPath() {
  try {
    const saved = localStorage.getItem('activeSection');
    if (saved && SECTION_TO_PATH[saved]) return SECTION_TO_PATH[saved];
  } catch {
    /* ignore */
  }
  return '/fixtures';
}
