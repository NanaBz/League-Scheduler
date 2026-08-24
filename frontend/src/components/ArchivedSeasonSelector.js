import React, { useEffect, useRef, useState } from 'react';
import { Archive, ChevronDown } from 'lucide-react';
import { seasonSelectorLabel, seasonArchiveBadge } from '../utils/archiveSeasonModel';

export default function ArchivedSeasonSelector({ seasons, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = seasons.find((s) => s._id === selectedId) || seasons[0] || null;

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!selected) return null;

  return (
    <div className="archived-season-selector" ref={rootRef}>
      <div className="archived-season-selector-badge">
        <Archive size={14} aria-hidden="true" />
        Historical archive
      </div>
      <button
        type="button"
        className="archived-season-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="archived-season-selector-label">{seasonSelectorLabel(selected)}</span>
        <ChevronDown size={18} className={`archived-season-selector-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <ul className="archived-season-selector-menu" role="listbox">
          {seasons.map((season) => {
            const isActive = season._id === selected._id;
            return (
              <li key={season._id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`archived-season-selector-option${isActive ? ' active' : ''}`}
                  onClick={() => {
                    onSelect(season._id);
                    setOpen(false);
                  }}
                >
                  <span className="archived-season-selector-option-main">
                    {seasonSelectorLabel(season)}
                  </span>
                  <span className="archived-season-selector-option-sub">
                    {seasonArchiveBadge(season)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
