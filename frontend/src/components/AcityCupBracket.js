import React from 'react';
import AcityCupPage from './cup/AcityCupPage';
import './AcityCupBracket.css';

export default function AcityCupBracket({ variant = 'full', user }) {
  const embedded = variant === 'compact' || variant === 'embed';

  return (
    <div
      className={[
        'acfpl-cup-bracket-root',
        embedded ? 'acfpl-cup-bracket-root--embed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AcityCupPage user={user} embedded={embedded} />
    </div>
  );
}
