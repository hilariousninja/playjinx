import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getMyRoom, isRoomToday, getRoomLastSeen } from '@/lib/my-room';
import { getPlayerId } from '@/lib/store';

/** Returns true when the user's current-day room has new participants since last seen */
export function useRoomHasNewActivity(): boolean {
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const myRoom = getMyRoom();
    if (!myRoom || !isRoomToday()) return;

    const check = async () => {
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('session_id, created_at')
        .eq('challenge_id', myRoom.challengeId);

      const others = (participants ?? []).filter(p => p.session_id !== getPlayerId());
      const lastSeen = getRoomLastSeen();
      const hasNewActivity = others.some(
        p => lastSeen && new Date(p.created_at) > new Date(lastSeen)
      );
      setHasNew(hasNewActivity);
    };

    check();

    const channel = supabase
      .channel('nav-room-activity')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'challenge_participants',
        filter: `challenge_id=eq.${myRoom.challengeId}`,
      }, () => { check(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return hasNew;
}
