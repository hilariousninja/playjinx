import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getMyRoom } from '@/lib/my-room';
import { getPlayerId } from '@/lib/store';

interface RoomInfo {
  token: string;
  participantCount: number;
  matchedNames: string[];
}

export default function MyRoomCard() {
  const [room, setRoom] = useState<RoomInfo | null>(null);

  useEffect(() => {
    const myRoom = getMyRoom();
    if (!myRoom) return;

    let cancelled = false;

    async function load() {
      const myRoom = getMyRoom();
      if (!myRoom) return;

      // Fetch participants
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('session_id, display_name')
        .eq('challenge_id', myRoom.challengeId);

      if (cancelled) return;

      const others = (participants ?? []).filter(p => p.session_id !== getPlayerId());
      if (others.length === 0) {
        setRoom({ token: myRoom.token, participantCount: 0, matchedNames: [] });
        return;
      }

      // Fetch match history for this challenge
      const { data: matches } = await supabase
        .from('match_history')
        .select('matched_display_name, prompts_matched')
        .eq('challenge_id', myRoom.challengeId)
        .eq('player_session_id', getPlayerId());

      const matchedNames = (matches ?? [])
        .filter(m => m.prompts_matched > 0)
        .sort((a, b) => b.prompts_matched - a.prompts_matched)
        .slice(0, 3)
        .map(m => m.matched_display_name);

      if (!cancelled) {
        setRoom({ token: myRoom.token, participantCount: others.length, matchedNames });
      }
    }

    load();

    // Subscribe to realtime participant updates
    const channel = supabase
      .channel(`my-room-${myRoom.challengeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'challenge_participants',
        filter: `challenge_id=eq.${myRoom.challengeId}`,
      }, () => { load(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!room) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Link
        to={`/c/${room.token}/compare`}
        className="block rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 hover:bg-primary/[0.08] transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-display font-bold text-foreground">
                {room.participantCount === 0
                  ? 'Your shared room'
                  : `Your room · ${room.participantCount} joined`}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {room.participantCount === 0
                  ? 'Waiting for friends to join…'
                  : room.matchedNames.length > 0
                    ? <>
                        <Zap className="h-2.5 w-2.5 inline text-primary mr-0.5" />
                        Matched with {room.matchedNames.join(', ')}
                      </>
                    : `${room.participantCount} ${room.participantCount === 1 ? 'friend' : 'friends'} played`}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-primary/50 shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
