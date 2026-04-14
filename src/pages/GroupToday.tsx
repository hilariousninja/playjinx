import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Share2, Loader2, AlertCircle, ArrowRight, Zap, LogOut, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import RoomResults from '@/components/RoomResults';
import GroupHistory from '@/components/GroupHistory';
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
import { getPlayerId, ensureDailyPrompts, syncCompletionStatus } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Tab = 'today' | 'history';

export default function GroupToday() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<JinxGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [results, setResults] = useState<GroupDayResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tab, setTab] = useState<Tab>('today');

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

        const prompts = await ensureDailyPrompts();
        const statusMap = await syncCompletionStatus(prompts);
        setHasPlayed(prompts.length > 0 && prompts.every(p => statusMap[p.id]));

        await loadData(g);
        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [inviteCode, navigate, loadData]);

  // Realtime
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
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-3 pb-8">
        {/* Group header — compact */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-[10px]"
        >
          <div className="flex items-center gap-[9px]">
            <div className="w-[30px] h-[30px] rounded-full bg-primary/12 border border-primary/15 flex items-center justify-center shrink-0">
              <Users className="h-[13px] w-[13px] text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-bold text-foreground truncate leading-tight">{group.name}</h1>
              <div className="flex items-center gap-[6px] text-[10px] text-muted-foreground mt-[1px]">
                <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                {answeredMembers > 0 && (
                  <>
                    <span className="text-foreground/10">·</span>
                    <span className="flex items-center gap-[3px]">
                      <span className="inline-block w-[5px] h-[5px] rounded-full bg-primary animate-pulse" />
                      {answeredMembers} played today
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleInvite}
              className="p-[6px] rounded-lg text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-0 rounded-[9px] bg-muted/50 p-[3px] mb-[12px]">
          {(['today', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-[6px] rounded-[7px] text-[11px] font-semibold transition-all ${
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
            >
              {t === 'today' ? 'Today' : 'History'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'today' ? (
          <div className="space-y-3">
            {/* Play CTA */}
            {!hasPlayed && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Button
                  size="lg"
                  className="w-full rounded-[10px] h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[13px] active:scale-[0.97] transition-transform"
                  asChild
                >
                  <Link to="/play">
                    Play today's JINX <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-[10px] text-muted-foreground/35 text-center mt-[6px]">
                  Your answers count for all your groups
                </p>
              </motion.div>
            )}

            {/* Waiting */}
            {hasPlayed && answeredMembers <= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-5 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full bg-primary/8">
                  <Radio className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.08em]">Waiting for others</span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {others.length === 0
                    ? 'Invite friends to get started'
                    : `${others.length} ${others.length === 1 ? 'member hasn\'t' : 'members haven\'t'} played yet`
                  }
                </p>
                {others.length === 0 && (
                  <Button variant="outline" size="sm" onClick={handleInvite} className="rounded-lg text-[11px] h-8 mt-1">
                    <Share2 className="h-3 w-3 mr-1.5" /> Invite
                  </Button>
                )}
              </motion.div>
            )}

            {/* Results */}
            {hasPlayed && answeredMembers >= 2 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <RoomResults results={roomResults} participants={roomParticipants} />
              </motion.div>
            )}
          </div>
        ) : (
          <GroupHistory groupId={group.id} groupName={group.name} />
        )}

        {/* Footer actions */}
        <div className="mt-5 space-y-1">
          {hasPlayed && tab === 'today' && (
            <Button variant="ghost" className="w-full rounded-lg h-8 text-[11px] text-muted-foreground" asChild>
              <Link to="/archive">View crowd results</Link>
            </Button>
          )}

          {!confirmLeave ? (
            <button
              onClick={() => setConfirmLeave(true)}
              className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground/25 hover:text-destructive/50 transition-colors py-1.5"
            >
              <LogOut className="h-2.5 w-2.5" />
              Leave group
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[10px] border border-destructive/20 bg-card p-[10px] flex items-center gap-2"
            >
              <p className="text-[11px] text-muted-foreground flex-1 truncate">
                Leave <span className="font-semibold text-foreground">{group.name}</span>?
              </p>
              <Button size="sm" variant="destructive" className="h-7 px-3 text-[11px] rounded-lg" onClick={handleLeave}>Leave</Button>
              <button onClick={() => setConfirmLeave(false)} className="text-muted-foreground/30 hover:text-muted-foreground">
                <span className="text-xs">✕</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
