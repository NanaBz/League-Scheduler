import React from 'react';
import { Check } from 'lucide-react';
import { PROGRESS_STEPS, ROUND_ORDER } from './cupConstants';

export default function CupProgressIndicator({ cup }) {
  const currentKey = cup?.currentRound?.round;
  const currentIdx = ROUND_ORDER.indexOf(currentKey);
  const isComplete = cup?.status === 'completed';

  return (
    <div className="acfpl-cup-progress" aria-label="Tournament progress">
      <p className="acfpl-cup-progress__title">Tournament path</p>
      <div className="acfpl-cup-progress__track">
        {PROGRESS_STEPS.map((step, index) => {
          let state = 'future';
          if (isComplete) state = 'done';
          else if (currentIdx >= 0) {
            if (index < currentIdx) state = 'done';
            else if (index === currentIdx) state = 'current';
          } else if (cup?.bracketGenerated && step.key === 'R32') {
            state = 'current';
          }

          return (
            <React.Fragment key={step.key}>
              <div className={`acfpl-cup-progress__node acfpl-cup-progress__node--${state}`}>
                <span className="acfpl-cup-progress__dot">
                  {state === 'done' ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className="acfpl-cup-progress__label">{step.short}</span>
              </div>
              {index < PROGRESS_STEPS.length - 1 ? (
                <span
                  className={`acfpl-cup-progress__line acfpl-cup-progress__line--${
                    state === 'done' ? 'done' : state === 'current' ? 'current' : 'future'
                  }`}
                  aria-hidden
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
