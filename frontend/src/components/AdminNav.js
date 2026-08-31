import React from 'react';
import { ListChecks, Users, Trophy, Eye, ScrollText } from 'lucide-react';
import './AdminNav.css';

const SECTIONS = [
  { id: 'fixtures-mgmt', label: 'Fixture Management', shortLabel: 'Fixtures', icon: ListChecks },
  { id: 'players-mgmt', label: 'Player Management', shortLabel: 'Players', icon: Users },
  { id: 'fantasy-mgmt', label: 'Fantasy Management', shortLabel: 'Fantasy', icon: Trophy },
  { id: 'activity-log', label: 'Activity Log', shortLabel: 'Activity', icon: ScrollText },
];

export default function AdminNav({ activeSection, onSelect, onSwitchToUser }) {
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <div className="admin-nav-bar">
        <span className="admin-nav-context" aria-hidden="true">
          Admin
        </span>

        <div className="admin-nav-tabs" role="tablist" aria-label="Admin section tabs">
          {SECTIONS.map(({ id, label, shortLabel, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`admin-nav-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`admin-panel-${id}`}
                className={`admin-nav-tab${isActive ? ' active' : ''}`}
                onClick={() => onSelect(id)}
              >
                <Icon size={16} className="admin-nav-tab-icon" aria-hidden="true" />
                <span className="admin-nav-tab-label admin-nav-tab-label--full">{label}</span>
                <span className="admin-nav-tab-label admin-nav-tab-label--short">{shortLabel}</span>
              </button>
            );
          })}
        </div>

        {onSwitchToUser && (
          <button
            type="button"
            className="admin-nav-user-link"
            onClick={onSwitchToUser}
            title="Switch to User View"
          >
            <Eye size={15} aria-hidden="true" />
            <span>User view</span>
          </button>
        )}
      </div>
    </nav>
  );
}
