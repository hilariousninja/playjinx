import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Share2, Loader2, AlertCircle, ArrowRight, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import GroupHistory from '@/components/GroupHistory';
import GroupTodayFeed from '@/components/GroupTodayFeed';
import GroupMembersList from '@/components/GroupMembersList';
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
import { markGroupVisited } from '@/lib/group-visits';


type Tab = 'today' | 'members' | 'history';


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

  // Mark visit on entry + exit so "new since" resets immediately
  useEffect(() => {
    if (!group) return;
    markGroupVisited(group.id);
    return () => { markGroupVisited(group.id); };
  }, [group]);

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

  // One-liner roster footer: "3/4 in · Sam, Maya, you"
  const playedNames = members
    .filter(m => answeredSessionIds.has(m.session_id))
    .sort((a, b) => {
      // self last so it reads naturally with " you"
      if (a.session_id === myId) return 1;
      if (b.session_id === myId) return -1;
      return 0;
    })
    .map(m => (m.session_id === myId ? 'you' : m.display_name));
  const rosterLine = playedNames.length > 0
    ? `${answeredMembers}/${members.length} in · ${playedNames.join(', ')}`
    : `0/${members.length} in`;

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
          {(['today', 'members', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-[6px] rounded-[7px] text-[11px] font-semibold transition-all capitalize ${
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
            >
              {t}
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

            {/* Result-led feed (handles its own blur/lock when !hasPlayed) */}
            {results.length > 0 && (
              <GroupTodayFeed
                results={results}
                inviteCode={group.invite_code}
                viewerPlayed={hasPlayed}
              />
            )}

            {/* One-liner roster footer */}
            {hasPlayed && (
              <div className="flex items-center justify-between gap-2 pt-[2px] px-[2px]">
                <p className="text-[10px] text-muted-foreground/70 font-display truncate">
                  {rosterLine}
                </p>
                {others.length === 0 ? (
                  <button
                    onClick={handleInvite}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Share2 className="h-2.5 w-2.5" /> Invite
                  </button>
                ) : (
                  <button
                    onClick={() => setTab('members')}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0"
                  >
                    See members →
                  </button>
                )}
              </div>
            )}

            {/* Crowd results link */}
            {hasPlayed && (
              <Button variant="ghost" className="w-full rounded-lg h-8 text-[11px] text-muted-foreground" asChild>
                <Link to="/archive">View crowd results</Link>
              </Button>
            )}
          </div>
        ) : tab === 'members' ? (
          <GroupMembersList
            groupId={group.id}
            inviteCode={group.invite_code}
            memberCount={members.length}
            onInvite={handleInvite}
          />
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
