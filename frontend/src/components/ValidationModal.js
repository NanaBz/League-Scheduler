import React from 'react';
import './ValidationModal.css';

export default function ValidationModal({ title, message, type = 'error', onClose, actionText = 'OK' }) {
  if (!message) return null;

  const icons = {
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
    success: '✓'
  };

  return (
    <div className="vm-overlay" onClick={onClose}>
      <div className="vm-modal" onClick={e => e.stopPropagation()}>
        <div className={`vm-content vm-${type}`}>
          <div className="vm-icon">{icons[type]}</div>
          <h3 className="vm-title">{title}</h3>
          <p className="vm-message">{message}</p>
        </div>
        <div className="vm-actions">
          <button className={`vm-btn vm-btn-${type}`} onClick={onClose}>
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}
