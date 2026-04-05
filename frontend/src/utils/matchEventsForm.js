/**
 * Convert persisted match.events[] into GoalScorerSelector / admin form shape.
 */
export function matchEventsToGoalscorerForm(events) {
  const goals = { home: [], away: [] };
  const cards = { home: [], away: [] };
  const cleanSheets = {
    home: { enabled: false, playerId: '' },
    away: { enabled: false, playerId: '' },
  };

  (events || []).forEach((ev) => {
    const pid = ev.player?._id || ev.player;
    const aid = ev.assistPlayer?._id || ev.assistPlayer;
    if (ev.type === 'GOAL') {
      goals[ev.side].push({
        scorerId: pid ? String(pid) : '',
        isOwnGoal: !!ev.ownGoal,
        assistId: aid ? String(aid) : '',
      });
    } else if (ev.type === 'YELLOW_CARD' || ev.type === 'RED_CARD') {
      cards[ev.side].push({
        playerId: pid ? String(pid) : '',
        type: ev.type,
        minute: ev.minute != null && ev.minute !== '' ? String(ev.minute) : '',
      });
    } else if (ev.type === 'CLEAN_SHEET') {
      cleanSheets[ev.side] = { enabled: true, playerId: pid ? String(pid) : '' };
    }
  });

  return { goals, cards, cleanSheets };
}

const emptyGoalSlot = () => ({
  scorerId: '',
  isOwnGoal: false,
  assistId: '',
});

/**
 * Grow or shrink goal arrays to match current scores; keep existing rows where possible.
 */
export function resizeGoalsToScores(prevGoals, hScore, aScore) {
  const next = { home: [], away: [] };
  ['home', 'away'].forEach((side) => {
    const n = side === 'home' ? hScore : aScore;
    const prevArr = prevGoals[side] || [];
    for (let i = 0; i < n; i++) {
      if (prevArr[i]) {
        next[side][i] = { ...prevArr[i] };
      } else {
        next[side][i] = emptyGoalSlot();
      }
    }
  });
  return next;
}

export function emptyGoalsForScores(hScore, aScore) {
  return resizeGoalsToScores({ home: [], away: [] }, hScore, aScore);
}
