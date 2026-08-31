import React from 'react';
import PropTypes from 'prop-types';
import { Cog } from 'lucide-react';
import '../styles/adminFab.css';

export default function AdminFab({ onClick, label = 'Admin panel' }) {
  return (
    <button
      type="button"
      className="admin-fab"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Cog size={24} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

AdminFab.propTypes = {
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string,
};
