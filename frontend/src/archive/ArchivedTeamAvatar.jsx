import React, { useState } from 'react';

export default function ArchivedTeamAvatar({ name, logoUrl, logoClass }) {
  const [broken, setBroken] = useState(false);
  const safeLogo = logoUrl && !broken ? logoUrl : null;
  const initial = (name && String(name).trim().charAt(0).toUpperCase()) || '?';
  return (
    <div className="archived-team-avatar-wrap">
      {safeLogo ? (
        <img src={safeLogo} alt="" className={logoClass} onError={() => setBroken(true)} />
      ) : (
        <div className="archived-team-avatar-fallback" aria-hidden>
          {initial}
        </div>
      )}
    </div>
  );
}
