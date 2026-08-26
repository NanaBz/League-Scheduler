import React, { useMemo, useState, useEffect } from 'react';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatches(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return matches;
}

/** Match is usable for week/round pickers if it has team refs and/or denormalized archive names. */
function matchHasSides(m) {
  if (!m) return false;
  const homeOk =
    (m.homeTeam != null && m.homeTeam !== '') ||
    (m.homeTeamName != null && String(m.homeTeamName).trim() !== '');
  const awayOk =
    (m.awayTeam != null && m.awayTeam !== '') ||
    (m.awayTeamName != null && String(m.awayTeamName).trim() !== '');
  return homeOk && awayOk;
}

export function buildFixtureFilterOptions(mode, matches) {
  const valid = (matches || []).filter(matchHasSides);
  if (mode === 'league') {
    const weeks = [...new Set(valid.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    return [{ value: '', label: 'All matchweeks' }, ...weeks.map((w) => ({ value: String(w), label: `Matchweek ${w}` }))];
  }
  if (mode === 'cup') {
    return [
      { value: '', label: 'All rounds' },
      { value: 'semi-final', label: 'Semi-final' },
      { value: 'final', label: 'Final' },
    ];
  }
  if (mode === 'acwpl') {
    const weeks = [...new Set(valid.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    return [
      { value: '', label: 'All matchweeks' },
      ...weeks.map((w) => ({ value: String(w), label: `Matchweek ${w}` })),
    ];
  }
  if (mode === 'girls-super-cup') {
    const rounds = [...new Set(valid.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    return [
      { value: '', label: 'All rounds' },
      ...rounds.map((r) => ({ value: String(r), label: `Round ${r}` })),
    ];
  }
  return [];
}

/** Static options: native select on desktop; bottom sheet + radios on small screens. */
export function AdminStaticFilter({ options, value, onChange, sheetTitle = 'Filter', className = '' }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentLabel =
    options.find((o) => String(o.value) === String(value))?.label ?? options[0]?.label ?? 'Select';

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className={`fixture-filter-trigger ${className}`.trim()}
          onClick={() => setSheetOpen(true)}
        >
          {currentLabel}
        </button>
        {sheetOpen && (
          <div className="fixture-filter-sheet-overlay" role="presentation" onClick={() => setSheetOpen(false)}>
            <div
              className="fixture-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fixture-filter-sheet-handle" />
              <h3 className="fixture-filter-sheet-title">{sheetTitle}</h3>
              <ul className="fixture-filter-sheet-list">
                {options.map((opt) => (
                  <li key={opt.value === '' ? '__all' : String(opt.value)}>
                    <label className="fixture-filter-sheet-option">
                      <input
                        type="radio"
                        name={`admin-static-filter-${sheetTitle}`}
                        checked={String(value) === String(opt.value)}
                        onChange={() => {
                          onChange(opt.value);
                          setSheetOpen(false);
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <select
      className={`fixture-filter-select ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value === '' ? '__all' : String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** League / Cup / ACWPL / Girls Super Cup filter: native select on desktop; bottom sheet + radios on small screens. */
export default function FixtureFilterControl({ mode, matches, value, onChange, className = '' }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const options = useMemo(() => buildFixtureFilterOptions(mode, matches), [mode, matches]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentLabel =
    options.find((o) => String(o.value) === String(value))?.label ?? options[0]?.label ?? 'Select';

  const sheetTitle =
    mode === 'girls-super-cup' ? 'Rounds' : mode === 'cup' ? 'Cup round' : 'Matchweeks';

  if (isMobile) {
    return (
      <>
        <button type="button" className={`fixture-filter-trigger ${className}`.trim()} onClick={() => setSheetOpen(true)}>
          {currentLabel}
        </button>
        {sheetOpen && (
          <div className="fixture-filter-sheet-overlay" role="presentation" onClick={() => setSheetOpen(false)}>
            <div
              className="fixture-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fixture-filter-sheet-handle" />
              <h3 className="fixture-filter-sheet-title">{sheetTitle}</h3>
              <ul className="fixture-filter-sheet-list">
                {options.map((opt) => (
                  <li key={opt.value === '' ? '__all' : String(opt.value)}>
                    <label className="fixture-filter-sheet-option">
                      <input
                        type="radio"
                        name={`fixture-filter-${mode}`}
                        checked={String(value) === String(opt.value)}
                        onChange={() => {
                          onChange(opt.value);
                          setSheetOpen(false);
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <select className={`fixture-filter-select ${className}`.trim()} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value === '' ? '__all' : String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
