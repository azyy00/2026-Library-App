import React from 'react';

// A calm, composed placeholder for surfaces that have no data yet.
// Pass a custom `icon` (SVG) or fall back to the default open-folder mark.
function EmptyState({ icon, title, description, action, compact = false, className = '' }) {
  return (
    <div
      className={`empty-state${compact ? ' empty-state-compact' : ''} ${className}`.trim()}
      role="status"
    >
      <div className="empty-state-icon" aria-hidden="true">
        {icon || <DefaultEmptyIcon />}
      </div>
      {title && <h5 className="empty-state-title">{title}</h5>}
      {description && <p className="empty-state-text">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5H19.5A1.5 1.5 0 0 1 21 10v7.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <path d="M8 13.5h8" opacity="0.5" />
    </svg>
  );
}

export default EmptyState;
