import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Share2, Loader2, AlertCircle, ArrowRight, Zap, LogOut, Settings, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import RoomResults from '@/components/RoomResults';
import {
  getGroupByInviteCode,
  getGroupMembers,
  getGroupDayResults,
  buildGroupInviteText,
  leaveGroup,
  isMemberOf,
  type JinxGroup,
  type GroupMember,
  type GroupDayResult,
} from '@/lib/groups';
import { getPlayerId, ensureDailyPrompts, getCompletedPrompts } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function GroupToday() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<JinxGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [results, setResults] = useState<GroupDayResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const myId = getPlayerId();

  const loadData = useCallback(async (g: JinxGroup) => {
    const [mems, res] = await Promise.all([
      getGroupMembers(g.id),
      getGroupDayResults(g.id),
    ]);
    setMembers(mems);
    setResults(res);
  }, []);

  useEffect(() => {
    if (!inviteCode) { setError('Invalid link'); setLoading(false); return; }

    (async () => {
      try {
        const g = await getGroupByInviteCode(inviteCode);
        if (!g) { setError('Group not found'); setLoading(false); return; }

        const member = await isMemberOf(g.id);
        if (!member) {
          navigate(`/g/${inviteCode}`, { replace: true });
          return;
        }

        setGroup(g);

        // Check if played today
        const prompts = await ensureDailyPrompts();
        const completed = getCompletedPrompts();
        setHasPlayed(prompts.every(p => completed.has(p.id)));

        await loadData(g);
        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [inviteCode, navigate, loadData]);

  // Realtime: listen for new members
  useEffect(() => {
    if (!group) return;
    const channel = supabase
      .channel(`group-${group.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${group.id}`,
      }, () => { loadData(group); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group, loadData]);

  const handleInvite = async () => {
    if (!group) return;
    const text = buildGroupInviteText(group);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Invite copied!', description: 'Share it with your group' });
  };

  const handleLeave = async () => {
    if (!group) return;
    await leaveGroup(group.id);
    navigate('/', { replace: true });
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (error || !group) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground">{error || 'Not found'}</h2>
        <Button className="rounded-lg" asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );

  const others = members.filter(m => m.session_id !== myId);
  const answeredMembers = results.length > 0
    ? new Set(results.flatMap(r => r.answers.map(a => a.session_id))).size
    : 0;

  // Convert group results to RoomResults-compatible format
  const roomParticipants = members.map(m => ({
    id: m.id,
    challenge_id: group.id,
    session_id: m.session_id,
    display_name: m.display_name,
    created_at: m.joined_at,
  }));

  const roomResults = results.map(r => ({
    prompt_id: r.prompt_id,
    word_a: r.word_a,
    word_b: r.word_b,
    answers: r.answers,
    clusters: r.clusters,
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/"><JinxLogo size={18} className="text-foreground text-base" /></Link>
          <div className="flex items-center gap-2">
            <PlayerIdentity />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" asChild>
              <Link to="/groups">Groups</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center pt-[4vh] md:pt-[6vh] pb-8 px-5">
        <div className="w-full max-w-sm mx-auto">
          {/* Group header — active/live feel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/15 mb-3">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-[12px] font-display font-bold text-primary tracking-tight">
                {group.name}
              </span>
            </div>

            <h1 className="font-display font-black text-2xl tracking-tight text-foreground mb-2">
              Today's JINX
            </h1>

            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
              {answeredMembers > 0 && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {answeredMembers} played today
                  </span>
                </>
              )}
            </div>
          </motion.div>

          {/* Play CTA if not played */}
          {!hasPlayed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-6"
            >
              <Button
                size="lg"
                className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base active:scale-[0.97] transition-transform"
                asChild
              >
                <Link to="/play">
                  Play today's JINX <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
                Your answers count for all your groups
              </p>
            </motion.div>
          )}

          {/* Waiting state */}
          {hasPlayed && answeredMembers <= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 space-y-3 mb-4"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[11px] font-display font-semibold text-primary uppercase tracking-[0.08em]">Waiting for others</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {others.length === 0
                  ? 'Invite friends to get started'
                  : `${others.length} ${others.length === 1 ? 'member hasn\'t' : 'members haven\'t'} played yet today`
                }
              </p>
              <Button onClick={handleInvite} variant="outline" className="rounded-xl h-10 text-sm">
                <Share2 className="h-3.5 w-3.5 mr-2" /> Invite to group
              </Button>
            </motion.div>
          )}

          {/* Group results */}
          {hasPlayed && answeredMembers >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <RoomResults results={roomResults} participants={roomParticipants} />
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 space-y-2"
          >
            <Button
              onClick={handleInvite}
              variant={hasPlayed && answeredMembers >= 2 ? 'default' : 'outline'}
              className="w-full rounded-xl h-10 text-sm active:scale-[0.97] transition-transform"
            >
              <Share2 className="h-3.5 w-3.5 mr-2" /> Invite to group
            </Button>

            {hasPlayed && (
              <Button variant="outline" className="w-full rounded-xl h-9 text-xs" asChild>
                <Link to="/archive">View crowd results</Link>
              </Button>
            )}
          </motion.div>

          {/* Settings dropdown */}
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-border/50 bg-card p-3 space-y-2"
            >
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-display">Group settings</p>
              <button
                onClick={handleLeave}
                className="flex items-center gap-2 w-full text-left text-sm text-destructive/70 hover:text-destructive py-1.5 px-2 rounded-lg hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave group
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
