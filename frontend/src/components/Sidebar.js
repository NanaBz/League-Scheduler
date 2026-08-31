import React, { useState } from 'react';
import { ListChecks, BarChart3, Users, Trophy, Archive, SidebarOpen, SidebarClose, Cog } from 'lucide-react';

export default function Sidebar({ activeSection, onSelect, showAdminPanel, onAdminPanelClick }) {
  const [collapsed, setCollapsed] = useState(false);

  const Item = ({ id, icon, label }) => (
    <button
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
    <aside className={`ls-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar Navigation">
      <div className="ls-sidebar-header">
        {!collapsed && <span>Navigation</span>}
        <button
          className="ls-sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <SidebarOpen size={18} /> : <SidebarClose size={18} />}
        </button>
      </div>
      <Item id="fixtures" icon={<ListChecks size={18} />} label="Fixtures & Results" />
      <Item id="stats" icon={<BarChart3 size={18} />} label="Stats" />
      <Item id="teams" icon={<Users size={18} />} label="Teams" />
      <Item id="fantasy" icon={<Trophy size={18} />} label="Fantasy" />
      <Item id="archived" icon={<Archive size={18} />} label="Archived" />
      {showAdminPanel && (
        <>
          <hr className="ls-sidebar-divider ls-sidebar-divider--admin" aria-hidden="true" />
          <button
            type="button"
            className="ls-sidebar-item ls-sidebar-item--admin-panel"
            onClick={() => onAdminPanelClick && onAdminPanelClick()}
            title="Admin panel"
          >
            <Cog size={18} aria-hidden="true" />
            {!collapsed && <span>Admin panel</span>}
          </button>
        </>
      )}
    </aside>
  );
}
