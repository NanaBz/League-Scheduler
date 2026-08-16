import React, { useState, useEffect } from 'react';

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

/**
 * Mobile-first competition picker: same look as FixtureFilterControl
 * (native select when viewport > 768px; bottom sheet + radios on small screens).
 */
export default function CompetitionFilterControl({ value, onChange, options, className = '' }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sheetOpen, setSheetOpen] = useState(false);

  const list = Array.isArray(options) ? options : [];
  const currentLabel = list.find((o) => String(o.value) === String(value))?.label ?? 'Select competition';

  const wrapClass = `competition-filter-field ${className}`.trim();

  if (isMobile) {
    return (
      <div className={wrapClass}>
        <span className="competition-filter-field-caption">Competition</span>
        <button
          type="button"
          className="fixture-filter-trigger"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          {currentLabel}
        </button>
        {sheetOpen && (
          <div className="fixture-filter-sheet-overlay" role="presentation" onClick={() => setSheetOpen(false)}>
            <div
              className="fixture-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Competition"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fixture-filter-sheet-handle" />
              <h3 className="fixture-filter-sheet-title">Competition</h3>
              <ul className="fixture-filter-sheet-list">
                {list.map((opt) => (
                  <li key={String(opt.value)}>
                    <label className="fixture-filter-sheet-option fixture-filter-sheet-option--spread">
                      <span>{opt.label}</span>
                      <input
                        type="radio"
                        name="competition-filter"
                        checked={String(value) === String(opt.value)}
                        onChange={() => {
                          onChange(opt.value);
                          setSheetOpen(false);
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <label className="competition-filter-field-caption" htmlFor="competition-filter-select">
        Competition
      </label>
      <select
        id="competition-filter-select"
        className="fixture-filter-trigger"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {list.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
