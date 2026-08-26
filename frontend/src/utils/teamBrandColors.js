/**
 * Brand colours for boys league/cup/super-cup banners and girls ACWPL teams.
 * Keep in sync with congratulatory banners in UserView (same hex pairs).
 */
const TEAM_BRAND = {
  Dragons: { primary: '#007bff', secondary: '#ffffff' },
  Vikings: { primary: '#dc3545', secondary: '#ffffff' },
  Warriors: { primary: '#ffc107', secondary: '#000000' },
  Falcons: { primary: '#ffffff', secondary: '#000000' },
  Elites: { primary: '#000000', secondary: '#ffffff' },
  Lions: { primary: '#28a745', secondary: '#ffffff' },
  Orion: { primary: '#000000', secondary: '#b0b3b8' },
  Firestorm: { primary: '#2563eb', secondary: '#ec4899' },
};

const BLACK = { r: 0, g: 0, b: 0 };

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '#64748b';
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.length === 7 ? h : '#64748b';
}

function parseRgb(hex) {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(1, 3), 16) / 255,
    g: parseInt(h.slice(3, 5), 16) / 255,
    b: parseInt(h.slice(5, 7), 16) / 255,
  };
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function toHexRgb({ r, g, b }) {
  const R = Math.round(clamp01(r) * 255)
    .toString(16)
    .padStart(2, '0');
  const G = Math.round(clamp01(g) * 255)
    .toString(16)
    .padStart(2, '0');
  const B = Math.round(clamp01(b) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${R}${G}${B}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function relativeLuminance({ r, g, b }) {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = f(r);
  const G = f(g);
  const B = f(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getTeamBrandColors(teamName) {
  if (!teamName) return { primary: '#64748b', secondary: '#ffffff' };
  return TEAM_BRAND[teamName] || { primary: '#64748b', secondary: '#ffffff' };
}

/** @deprecated use getTeamBrandColors — alias kept for UserView banners */
export const getTeamColors = getTeamBrandColors;

/**
 * Theme for the team detail hero card: diagonal gradient from brand colours,
 * readable title colour, translucent controls (MU-style reference).
 */
export function teamHeroTheme(teamName) {
  const { primary, secondary } = getTeamBrandColors(teamName);
  const p = parseRgb(primary);
  const s = parseRgb(secondary);
  const lumP = relativeLuminance(p);

  /** Falcons: white-led hero with slate greys (not black-led). */
  if (teamName === 'Falcons') {
    const g1 = parseRgb('#ffffff');
    const g2 = parseRgb('#f8fafc');
    const g3 = parseRgb('#e2e8f0');
    const g4 = parseRgb('#cbd5e1');
    const background = `linear-gradient(148deg, ${toHexRgb(g1)} 0%, ${toHexRgb(g2)} 38%, ${toHexRgb(
      g3
    )} 72%, ${toHexRgb(mixRgb(g4, g3, 0.5))} 100%)`;
    return {
      background,
      color: '#0f172a',
      mutedColor: 'rgba(51, 65, 85, 0.85)',
      backBtnBg: 'rgba(15, 23, 42, 0.08)',
      backBtnHoverBg: 'rgba(15, 23, 42, 0.14)',
      logoWrapBg: 'rgba(148, 163, 184, 0.28)',
      logoBorder: 'rgba(100, 116, 139, 0.35)',
    };
  }

  /** Firestorm: blue anchor left, pink secondary clearly visible across mid–right. */
  if (teamName === 'Firestorm') {
    const blue = parseRgb('#2563eb');
    const pink = parseRgb('#ec4899');
    const blueDark = mixRgb(blue, BLACK, 0.42);
    const blueMid = mixRgb(blue, pink, 0.35);
    const mid = mixRgb(blue, pink, 0.62);
    const pinkMid = mixRgb(pink, blue, 0.12);
    const pinkRich = mixRgb(pink, BLACK, 0.18);
    const background = `linear-gradient(128deg, ${toHexRgb(blueDark)} 0%, ${toHexRgb(blue)} 18%, ${toHexRgb(
      blueMid
    )} 34%, ${toHexRgb(mid)} 52%, ${toHexRgb(pinkMid)} 74%, ${toHexRgb(pinkRich)} 100%)`;
    return {
      background,
      color: '#ffffff',
      mutedColor: 'rgba(255,255,255,0.9)',
      backBtnBg: 'rgba(0,0,0,0.38)',
      backBtnHoverBg: 'rgba(0,0,0,0.5)',
      logoWrapBg: 'rgba(255,255,255,0.14)',
      logoBorder: 'rgba(255,255,255,0.32)',
    };
  }

  if (lumP > 0.9) {
    const base = relativeLuminance(s) < lumP ? s : parseRgb('#0f172a');
    const mid = toHexRgb(mixRgb(base, p, 0.14));
    const end = toHexRgb(mixRgb(base, BLACK, 0.2));
    const background = `linear-gradient(148deg, ${toHexRgb(base)} 0%, ${mid} 55%, ${end} 100%)`;
    return {
      background,
      color: '#ffffff',
      mutedColor: 'rgba(255,255,255,0.88)',
      backBtnBg: 'rgba(255,255,255,0.28)',
      backBtnHoverBg: 'rgba(255,255,255,0.4)',
      logoWrapBg: 'rgba(255,255,255,0.14)',
      logoBorder: 'rgba(255,255,255,0.35)',
    };
  }

  const pDeep = mixRgb(p, BLACK, 0.55);
  const pDark = mixRgb(p, BLACK, 0.38);
  const blend = mixRgb(p, s, 0.28);
  const pEnd = mixRgb(p, BLACK, 0.48);
  const background = `linear-gradient(148deg, ${toHexRgb(pDeep)} 0%, ${toHexRgb(pDark)} 26%, ${toHexRgb(
    p
  )} 48%, ${toHexRgb(blend)} 74%, ${toHexRgb(pEnd)} 100%)`;

  const midLum = (relativeLuminance(pDeep) + relativeLuminance(pDark) + relativeLuminance(p)) / 3;
  const useDarkText = midLum > 0.62;
  const color = useDarkText ? '#0f172a' : '#ffffff';
  const mutedColor = useDarkText ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.92)';
  const backBtnBg = useDarkText ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.38)';
  const backBtnHoverBg = useDarkText ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.52)';
  const logoWrapBg = useDarkText ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)';
  const logoBorder = useDarkText ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.3)';

  return { background, color, mutedColor, backBtnBg, backBtnHoverBg, logoWrapBg, logoBorder };
}

/**
 * Readable accent colours for team profile UI (icons, borders) on light surfaces.
 * Brand primaries that are white or very light (e.g. Falcons) map to slate greys
 * that still reflect the team's silver / monochrome identity.
 */
export function teamProfileAccent(teamName) {
  const { primary, secondary } = getTeamBrandColors(teamName);

  if (teamName === 'Falcons') {
    return {
      accent: '#475569',
      accentMuted: 'rgba(148, 163, 184, 0.24)',
      borderAccent: '#94a3b8',
    };
  }

  if (teamName === 'Warriors') {
    return {
      accent: '#92400e',
      accentMuted: 'rgba(251, 191, 36, 0.28)',
      borderAccent: '#d97706',
    };
  }

  const p = parseRgb(primary);
  const lumP = relativeLuminance(p);

  if (lumP > 0.85) {
    const lumS = relativeLuminance(parseRgb(secondary));
    if (lumS < 0.45) {
      const accent = normalizeHex(secondary);
      return {
        accent,
        accentMuted: `${accent}22`,
        borderAccent: accent,
      };
    }
    return {
      accent: '#475569',
      accentMuted: 'rgba(100, 116, 139, 0.16)',
      borderAccent: '#64748b',
    };
  }

  if (lumP > 0.55) {
    const accent = toHexRgb(mixRgb(p, BLACK, 0.48));
    const border = normalizeHex(primary);
    return {
      accent,
      accentMuted: `${border}28`,
      borderAccent: border,
    };
  }

  const accent = normalizeHex(primary);
  return {
    accent,
    accentMuted: `${accent}18`,
    borderAccent: accent,
  };
}
