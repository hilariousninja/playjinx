import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Zap, Share2, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getMyRoom, isRoomToday, getRoomLastSeen, markRoomSeen } from '@/lib/my-room';
import { getPlayerId } from '@/lib/store';
import { getDisplayName } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

interface RoomState {
  token: string;
  challengeId: string;
  participantCount: number;
  bestInsight: React.ReactNode;
  hasNewActivity: boolean;
  isToday: boolean;
}

export default function MyRoomCard() {
  const [room, setRoom] = useState<RoomState | null>(null);

  const load = useCallback(async () => {
    const myRoom = getMyRoom();
    if (!myRoom) return;

    const today = isRoomToday();

    const { data: participants } = await supabase
      .from('challenge_participants')
      .select('session_id, display_name, created_at')
      .eq('challenge_id', myRoom.challengeId);

    const others = (participants ?? []).filter(p => p.session_id !== getPlayerId());

    const lastSeen = getRoomLastSeen();
    const hasNewActivity = others.some(
      p => lastSeen && new Date(p.created_at) > new Date(lastSeen)
    );

    // Pick the single best insight line
    let bestInsight: React.ReactNode;

    if (others.length === 0) {
      bestInsight = today ? 'Waiting for responses…' : 'No one joined';
    } else {
      // Try match history first
      const { data: matches } = await supabase
        .from('match_history')
        .select('matched_display_name, prompts_matched')
        .eq('challenge_id', myRoom.challengeId)
        .eq('player_session_id', getPlayerId());

      const topMatch = (matches ?? [])
        .filter(m => m.prompts_matched > 0)
        .sort((a, b) => b.prompts_matched - a.prompts_matched)[0];

      if (topMatch) {
        bestInsight = (
          <>
            <Zap className="h-2.5 w-2.5 inline text-primary mr-0.5" />
            Matched most with {topMatch.matched_display_name}
          </>
        );
      } else {
        bestInsight = `${others.length} ${others.length === 1 ? 'friend' : 'friends'} joined`;
      }
    }

    setRoom({
      token: myRoom.token,
      challengeId: myRoom.challengeId,
      participantCount: others.length,
      bestInsight,
      hasNewActivity,
      isToday: today,
    });
  }, []);

  useEffect(() => {
    load();

    const myRoom = getMyRoom();
    if (!myRoom) return;

    const channel = supabase
      .channel(`my-room-${myRoom.challengeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'challenge_participants',
        filter: `challenge_id=eq.${myRoom.challengeId}`,
      }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (!room) return null;

  const handleReshare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const name = getDisplayName();
    const intro = name ? `Can you match ${name}?` : 'Can you match me?';
    const url = `${window.location.origin}/c/${room.token}`;
    const text = `⚡ JINX Daily\n\n${intro}\n\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Link copied!', description: 'Share it with more friends' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] overflow-hidden">
        <Link
          to={`/c/${room.token}/compare`}
          onClick={() => markRoomSeen()}
          className="block px-3.5 py-2.5 hover:bg-primary/[0.08] transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-3 w-3 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-display font-bold text-foreground leading-tight">
                    {room.isToday ? "Today's room" : 'Past room'}
                  </p>
                  {room.isToday && room.hasNewActivity && (
                    <span className="text-[7px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-display font-bold animate-pulse leading-none">
                      New
                    </span>
                  )}
                  {room.isToday && !room.hasNewActivity && room.participantCount === 0 && (
                    <span className="text-[7px] bg-primary/10 text-primary/70 px-1.5 py-px rounded-full font-display font-bold flex items-center gap-0.5 leading-none">
                      <Radio className="h-2 w-2" /> Live
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                  {room.participantCount > 0 && (
                    <span className="font-medium text-foreground/60 mr-1">
                      {room.participantCount} joined ·
                    </span>
                  )}
                  {room.bestInsight}
                </p>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-primary/40 shrink-0" />
          </div>
        </Link>

        {room.isToday && (
          <button
            onClick={handleReshare}
            className="w-full flex items-center justify-center gap-1 py-1.5 border-t border-primary/10 text-[10px] font-display font-semibold text-primary/60 hover:text-primary hover:bg-primary/[0.06] transition-colors"
          >
            <Share2 className="h-2.5 w-2.5" />
            {room.participantCount === 0 ? 'Send to your group' : 'Reshare link'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
