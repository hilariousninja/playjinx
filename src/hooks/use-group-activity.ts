import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyGroups } from '@/lib/groups';

/** Returns true when any of the user's groups has activity today from other members */
export function useGroupHasActivity(): boolean {
  const [hasActivity, setHasActivity] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const groups = await getMyGroups();
        setHasActivity(groups.some(g => g.hasActivityToday));
      } catch {
        // silently fail
      }
    })();
  }, [pathname]);

  return hasActivity;
}

/** Total "new since last visit" count across all the viewer's groups. */
export function useGroupNewCount(): number {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const groups = await getMyGroups();
        setCount(groups.reduce((n, g) => n + (g.newSinceLastVisit || 0), 0));
      } catch {
        // silently fail
      }
    })();
  }, [pathname]);

  return count;
}
