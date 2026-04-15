import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Share2, Loader2, AlertCircle, ArrowRight, LogOut, Clock, CheckCircle2, Circle } from 'lucide-react';
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

/* ── Member roster row ── */
function MemberRow({ member, hasAnswered, isMe }: { member: GroupMember; hasAnswered: boolean; isMe: boolean }) {
  return (
    <div className="flex items-center gap-[8px] py-[5px]">
      {hasAnswered ? (
        <CheckCircle2 className="h-[14px] w-[14px] text-primary shrink-0" />
      ) : (
        <Circle className="h-[14px] w-[14px] text-muted-foreground/20 shrink-0" />
      )}
      <span className={`text-[12px] font-display truncate ${isMe ? 'font-bold text-foreground' : hasAnswered ? 'text-foreground/80' : 'text-muted-foreground/40'}`}>
        {member.display_name}{isMe ? ' (you)' : ''}
      </span>
      {hasAnswered && (
        <span className="text-[9px] text-primary/60 font-semibold ml-auto shrink-0">played</span>
      )}
    </div>
  );
}

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
  const answeredSessionIds = results.length > 0
    ? new Set(results.flatMap(r => r.answers.map(a => a.session_id)))
    : new Set<string>();
  const answeredMembers = answeredSessionIds.size;

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

  const showResults = hasPlayed && answeredMembers >= 2;
  const showWaiting = hasPlayed && answeredMembers <= 1;
  const waitingCount = members.filter(m => !answeredSessionIds.has(m.session_id)).length;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-3 pb-8">
        {/* Group header */}
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
              <p className="text-[10px] text-muted-foreground mt-[1px]">
                {members.length} {members.length === 1 ? 'member' : 'members'}
                {answeredMembers > 0 && ` · ${answeredMembers}/${members.length} played`}
              </p>
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
        <div className="flex gap-0 rounded-[9px] bg-muted/50 p-[3px] mb-[10px]">
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
          <div className="space-y-[10px]">
            {/* Play CTA — not played yet */}
            {!hasPlayed && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="rounded-[12px] border border-primary/15 bg-primary/[0.04] p-[14px]">
                  <div className="flex items-center gap-[6px] mb-[8px]">
                    <Clock className="h-[13px] w-[13px] text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.08em]">Your turn</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mb-[10px] leading-[1.4]">
                    Play today's prompts to unlock this group's results.
                    {answeredMembers > 0 && ` ${answeredMembers} ${answeredMembers === 1 ? 'member has' : 'members have'} already played.`}
                  </p>
                  <Button
                    size="sm"
                    className="w-full rounded-[8px] h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[12px] active:scale-[0.97] transition-transform"
                    asChild
                  >
                    <Link to="/play">
                      Play today's JINX <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Waiting — played but not enough others */}
            {showWaiting && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="rounded-[12px] border border-border/50 bg-card p-[14px]">
                  {/* Status */}
                  <div className="flex items-center justify-between mb-[10px]">
                    <div className="flex items-center gap-[6px]">
                      <span className="inline-block w-[6px] h-[6px] rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-[0.08em]">Waiting for group</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/40">{answeredMembers}/{members.length} played</span>
                  </div>

                  {/* Member roster */}
                  <div className="divide-y divide-border/30">
                    {/* Show me first, then others */}
                    {members
                      .sort((a, b) => {
                        if (a.session_id === myId) return -1;
                        if (b.session_id === myId) return 1;
                        const aPlayed = answeredSessionIds.has(a.session_id);
                        const bPlayed = answeredSessionIds.has(b.session_id);
                        if (aPlayed && !bPlayed) return -1;
                        if (!aPlayed && bPlayed) return 1;
                        return 0;
                      })
                      .map(m => (
                        <MemberRow
                          key={m.id}
                          member={m}
                          hasAnswered={answeredSessionIds.has(m.session_id)}
                          isMe={m.session_id === myId}
                        />
                      ))}
                  </div>

                  {/* Contextual message */}
                  <div className="mt-[10px] pt-[8px] border-t border-border/30">
                    {others.length === 0 ? (
                      <div className="flex items-center gap-[8px]">
                        <p className="text-[11px] text-muted-foreground flex-1">Invite someone to compare answers</p>
                        <Button variant="outline" size="sm" onClick={handleInvite} className="rounded-[8px] text-[10px] h-7 px-2.5 shrink-0">
                          <Share2 className="h-3 w-3 mr-1" /> Invite
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground text-center">
                        Results unlock when {waitingCount === 1 ? '1 more member plays' : `${waitingCount} more members play`}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Results ready */}
            {showResults && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <RoomResults results={roomResults} participants={roomParticipants} />
              </motion.div>
            )}

            {/* Crowd results link */}
            {hasPlayed && (
              <Button variant="ghost" className="w-full rounded-lg h-8 text-[11px] text-muted-foreground" asChild>
                <Link to="/archive">View crowd results</Link>
              </Button>
            )}
          </div>
        ) : (
          <GroupHistory groupId={group.id} groupName={group.name} />
        )}

        {/* Leave group */}
        <div className="mt-4">
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
