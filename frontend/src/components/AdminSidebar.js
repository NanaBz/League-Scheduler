import React, { useState } from 'react';
import { ListChecks, Users, Trophy, SidebarOpen, SidebarClose, Eye } from 'lucide-react';

export default function AdminSidebar({ activeSection, onSelect, onSwitchToUser, isAdmin }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!isAdmin) return null;

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
    <aside className={`ls-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Admin Navigation">
      <div className="ls-sidebar-header">
        {!collapsed && <span>Admin</span>}
        <button
          className="ls-sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <SidebarOpen size={18} /> : <SidebarClose size={18} />}
        </button>
      </div>
      <button
        className="ls-sidebar-item"
        onClick={() => onSwitchToUser && onSwitchToUser()}
        title="Switch to User View"
      >
        <Eye size={18} />
        {!collapsed && <span>Switch to User View</span>}
      </button>
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }}></div>
      <Item id="fixtures-mgmt" icon={<ListChecks size={18} />} label="Fixture Management" />
      <Item id="players-mgmt" icon={<Users size={18} />} label="Player Management" />
      <Item id="fantasy-mgmt" icon={<Trophy size={18} />} label="Fantasy Management" />
    </aside>
  );
}
