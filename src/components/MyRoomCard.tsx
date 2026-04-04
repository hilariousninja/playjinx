import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Zap, Share2, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getMyRoom, isRoomToday, getRoomLastSeen, markRoomSeen } from '@/lib/my-room';
import { getPlayerId } from '@/lib/store';
import { buildChallengeShareText } from '@/lib/challenge';
import { getDisplayName } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

interface RoomState {
  token: string;
  challengeId: string;
  participantCount: number;
  matchedNames: string[];
  bestCluster: string | null;
  hasNewActivity: boolean;
  isToday: boolean;
}

export default function MyRoomCard({ compact = false }: { compact?: boolean }) {
  const [room, setRoom] = useState<RoomState | null>(null);

  const load = useCallback(async () => {
    const myRoom = getMyRoom();
    if (!myRoom) return;

    const today = isRoomToday();

    // Fetch participants
    const { data: participants } = await supabase
      .from('challenge_participants')
      .select('session_id, display_name, created_at')
      .eq('challenge_id', myRoom.challengeId);

    const others = (participants ?? []).filter(p => p.session_id !== getPlayerId());

    // Check for new activity since last seen
    const lastSeen = getRoomLastSeen();
    const hasNewActivity = others.some(p => lastSeen && new Date(p.created_at) > new Date(lastSeen));

    // Fetch match history
    const { data: matches } = await supabase
      .from('match_history')
      .select('matched_display_name, prompts_matched')
      .eq('challenge_id', myRoom.challengeId)
      .eq('player_session_id', getPlayerId());

    const matchedNames = (matches ?? [])
      .filter(m => m.prompts_matched > 0)
      .sort((a, b) => b.prompts_matched - a.prompts_matched)
      .slice(0, 2)
      .map(m => m.matched_display_name);

    // Get best cluster from all answers for this challenge
    let bestCluster: string | null = null;
    if (others.length > 0) {
      // Fetch prompts for this challenge to get prompt IDs
      const { data: challenge } = await supabase
        .from('challenges')
        .select('answers')
        .eq('id', myRoom.challengeId)
        .maybeSingle();

      if (challenge?.answers && Array.isArray(challenge.answers)) {
        const promptIds = (challenge.answers as any[]).map((a: any) => a.prompt_id);
        const allSessionIds = (participants ?? []).map(p => p.session_id);

        const { data: answers } = await supabase
          .from('answers')
          .select('raw_answer, normalized_answer')
          .in('prompt_id', promptIds)
          .in('session_id', allSessionIds);

        if (answers && answers.length > 0) {
          const freq: Record<string, number> = {};
          answers.forEach(a => {
            freq[a.normalized_answer] = (freq[a.normalized_answer] || 0) + 1;
          });
          const top = Object.entries(freq)
            .filter(([, c]) => c >= 2)
            .sort(([, a], [, b]) => b - a)[0];
          if (top) bestCluster = top[0].toUpperCase();
        }
      }
    }

    setRoom({
      token: myRoom.token,
      challengeId: myRoom.challengeId,
      participantCount: others.length,
      matchedNames,
      bestCluster,
      hasNewActivity,
      isToday: today,
    });
  }, []);

  useEffect(() => {
    load();

    const myRoom = getMyRoom();
    if (!myRoom) return;

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

  // Build summary line
  const getSummary = () => {
    if (room.participantCount === 0) {
      return 'Waiting for responses…';
    }
    if (room.matchedNames.length > 0) {
      return (
        <>
          <Zap className="h-2.5 w-2.5 inline text-primary mr-0.5" />
          Matched most with {room.matchedNames[0]}
        </>
      );
    }
    if (room.bestCluster) {
      return <>Biggest cluster: {room.bestCluster}</>;
    }
    return `${room.participantCount} ${room.participantCount === 1 ? 'friend' : 'friends'} joined`;
  };

  // Badge
  const getBadge = () => {
    if (!room.isToday) return null;
    if (room.hasNewActivity) {
      return (
        <span className="text-[8px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-display font-bold animate-pulse">
          New
        </span>
      );
    }
    if (room.participantCount === 0) {
      return (
        <span className="text-[8px] bg-primary/10 text-primary/70 px-1.5 py-0.5 rounded-full font-display font-bold flex items-center gap-0.5">
          <Radio className="h-2 w-2" /> Live
        </span>
      );
    }
    return null;
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
          className="block px-4 py-3 hover:bg-primary/[0.08] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-display font-bold text-foreground">
                    {room.isToday ? "Today's shared room" : 'Past shared room'}
                  </p>
                  {getBadge()}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {room.participantCount > 0 && (
                    <span className="font-medium text-foreground/60 mr-1">
                      {room.participantCount} joined ·
                    </span>
                  )}
                  {getSummary()}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary/50 shrink-0" />
          </div>
        </Link>

        {/* Reshare strip */}
        {room.isToday && (
          <button
            onClick={handleReshare}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-primary/10 text-[11px] font-display font-semibold text-primary/70 hover:text-primary hover:bg-primary/[0.06] transition-colors"
          >
            <Share2 className="h-3 w-3" />
            {room.participantCount === 0 ? 'Send to your group' : 'Reshare link'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
