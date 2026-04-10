import { useState, useEffect } from 'react';
import { getMyGroups } from '@/lib/groups';

/** Returns true when any of the user's groups has activity today from other members */
export function useGroupHasActivity(): boolean {
  const [hasActivity, setHasActivity] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const groups = await getMyGroups();
        setHasActivity(groups.some(g => g.hasActivityToday));
      } catch {
        // silently fail
      }
    })();
  }, []);

  return hasActivity;
}
