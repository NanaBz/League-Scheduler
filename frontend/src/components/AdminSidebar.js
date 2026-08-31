import React, { useState } from 'react';
import { ListChecks, Users, Trophy, SidebarOpen, SidebarClose, Eye, ScrollText } from 'lucide-react';

export default function AdminSidebar({ activeSection, onSelect, onSwitchToUser, isAdmin }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!isAdmin) return null;

  const Item = ({ id, icon, label }) => (
    <button
      type="button"
      className={`ls-sidebar-item ${activeSection === id ? 'active' : ''}`}
      onClick={() => onSelect(id)}
      aria-current={activeSection === id ? 'page' : undefined}
      title={label}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );

  return (
    <aside className={`ls-sidebar ls-sidebar--admin ${collapsed ? 'collapsed' : ''}`} aria-label="Admin Navigation">
      <div className="ls-sidebar-header">
        {!collapsed && <span className="ls-sidebar-header__label">Admin</span>}
        <button
          type="button"
          className="ls-sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <SidebarOpen size={18} /> : <SidebarClose size={18} />}
        </button>
      </div>
      <button
        type="button"
        className="ls-sidebar-item ls-sidebar-item--user-view"
        onClick={() => onSwitchToUser && onSwitchToUser()}
        title="Switch to User View"
      >
        <Eye size={18} aria-hidden="true" />
        {!collapsed && <span>Switch to User View</span>}
      </button>
      <hr className="admin-sidebar-divider" aria-hidden="true" />
      <Item id="fixtures-mgmt" icon={<ListChecks size={18} />} label="Fixture Management" />
      <Item id="players-mgmt" icon={<Users size={18} />} label="Player Management" />
      <Item id="fantasy-mgmt" icon={<Trophy size={18} />} label="Fantasy Management" />
      <Item id="activity-log" icon={<ScrollText size={18} />} label="Activity Log" />
    </aside>
  );
}
