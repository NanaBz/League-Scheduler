import { useEffect, useRef } from 'react';

const REMINDERS = [
  { ms: 2 * 60 * 60 * 1000, label: '2 hours' },
  { ms: 60 * 60 * 1000, label: '1 hour' },
  { ms: 30 * 60 * 1000, label: '30 minutes' },
];

/** Browser notifications before fantasy deadline (2h, 1h, 30m). */
export function useFantasyDeadlineNotifications(deadline, gameweek) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!deadline || !gameweek || typeof window === 'undefined') return undefined;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const deadlineMs = new Date(deadline).getTime();
    const timers = [];

    for (const { ms, label } of REMINDERS) {
      const key = `${gameweek}-${ms}`;
      const fireAt = deadlineMs - ms;
      const delay = fireAt - Date.now();
      if (delay <= 0 || firedRef.current.has(key)) continue;

      timers.push(
        setTimeout(() => {
          if (firedRef.current.has(key)) return;
          firedRef.current.add(key);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Fantasy deadline approaching', {
              body: `Gameweek ${gameweek} — ${label} until the deadline.`,
              tag: key,
            });
          }
        }, delay)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [deadline, gameweek]);
}
