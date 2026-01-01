import React, { useState } from 'react';
import { ListChecks, BarChart3, Users, Trophy, SidebarOpen, SidebarClose } from 'lucide-react';

export default function Sidebar({ activeSection, onSelect }) {
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
    </aside>
  );
}
