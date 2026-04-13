import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Loader2, ArrowRight, LogOut, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import { getMyGroups, createGroup, leaveGroup, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import DisplayNameInput from '@/components/DisplayNameInput';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';
import { toast } from '@/hooks/use-toast';

const AVATAR_COLORS = [
  { bg: 'bg-primary/15', text: 'text-primary' },
  { bg: 'bg-[hsl(var(--info))]/10', text: 'text-[hsl(var(--info))]' },
  { bg: 'bg-[hsl(var(--success))]/10', text: 'text-[hsl(var(--success))]' },
  { bg: 'bg-muted', text: 'text-muted-foreground' },
];

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();

  useEffect(() => {
    (async () => {
      const gs = await getMyGroups();
      setGroups(gs);
      setLoading(false);
    })();
  }, []);

  const handleCreate = async () => {
    if (!getDisplayName()) { setNeedsName(true); return; }
    setCreating(true);
    try {
      const g = await createGroup(groupName.trim() || 'My JINX group');
      navigate(`/g/${g.invite_code}/today`);
    } catch {
      toast({ title: 'Could not create group', variant: 'destructive' });
    }
    setCreating(false);
  };

  const handleNameThenCreate = async (name: string) => {
    setDisplayName(name);
    setNeedsName(false);
    await handleCreate();
  };

  const handleLeave = async (groupId: string) => {
    setLeaving(true);
    try {
      await leaveGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setConfirmLeave(null);
      toast({ title: 'Left group' });
    } catch {
      toast({ title: 'Could not leave group', variant: 'destructive' });
    }
    setLeaving(false);
  };

  const getActivityContent = (g: GroupWithActivity) => {
    if (g.memberCount === 1) return { type: 'solo' as const, text: 'Just you right now' };
    if (g.todayAnsweredCount === 0) return { type: 'quiet' as const, text: "Nobody's played today" };
    if (g.todayAnsweredCount < g.memberCount) return { type: 'waiting' as const, text: `${g.todayAnsweredCount} played · waiting for ${g.memberCount - g.todayAnsweredCount} more` };
    return { type: 'complete' as const, text: 'Everyone played today!' };
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <div className="flex-1 max-w-md mx-auto px-4 pt-4 pb-10 w-full">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[18px] font-bold text-foreground mb-[2px]">Your groups</h1>
          <p className="text-[12px] text-muted-foreground mb-[10px]">Same prompts, same people, every day.</p>
        </motion.div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <div className="space-y-[8px]">
            {groups.map((g, i) => {
              const activity = getActivityContent(g);
              const colorSet = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const initial = g.name.substring(0, 2).toUpperCase();

              if (confirmLeave === g.id) {
                return (
                  <div key={g.id} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-card">
                    <p className="text-xs text-muted-foreground flex-1 truncate">
                      Leave <span className="font-semibold text-foreground">{g.name}</span>?
                    </p>
                    <Button size="sm" variant="destructive" className="h-7 px-3 text-[11px] rounded-lg" onClick={() => handleLeave(g.id)} disabled={leaving}>
                      {leaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Leave'}
                    </Button>
                    <button onClick={() => setConfirmLeave(null)} className="text-muted-foreground/40 hover:text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-[14px] border border-foreground/[0.08] overflow-hidden group/card"
                >
                  <Link
                    to={`/g/${g.invite_code}/today`}
                    className="flex items-center gap-[10px] px-[14px] py-[12px] hover:bg-accent/30 transition-colors"
                  >
                    <div className={`w-[36px] h-[36px] rounded-full ${colorSet.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-[13px] font-bold ${colorSet.text}`}>{initial}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-foreground mb-[2px] truncate">{g.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-primary/50 transition-colors shrink-0" />
                  </Link>

                  {/* Activity bar */}
                  <div className={`mx-[14px] mb-[12px] rounded-[10px] px-[11px] py-[9px] flex items-center gap-[8px] ${
                    activity.type === 'complete' ? 'bg-[hsl(var(--success))]/8' :
                    activity.type === 'waiting' ? 'bg-primary/8' :
                    activity.type === 'quiet' ? 'bg-muted/50' :
                    'bg-primary/6'
                  }`}>
                    <span className="text-[12px] shrink-0">
                      {activity.type === 'complete' ? '✓' : activity.type === 'waiting' ? '⏳' : activity.type === 'quiet' ? '💤' : '👋'}
                    </span>
                    <span className={`text-[11px] leading-[1.4] flex-1 ${
                      activity.type === 'complete' ? 'text-[hsl(var(--success))] font-medium' :
                      activity.type === 'waiting' ? 'text-foreground/70' :
                      'text-muted-foreground'
                    }`}>
                      {activity.type === 'solo' ? 'Invite someone to compare answers' : activity.text}
                    </span>
                    {activity.type === 'solo' && (
                      <Link to={`/g/${g.invite_code}/today`} className="text-[11px] text-primary font-semibold whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        Invite →
                      </Link>
                    )}
                    {activity.type === 'quiet' && (
                      <Link to={`/g/${g.invite_code}/today`} className="text-[11px] text-primary font-medium whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        Nudge →
                      </Link>
                    )}
                  </div>

                  {/* Stats row for active groups */}
                  {g.memberCount > 1 && activity.type !== 'solo' && (
                    <div className="border-t border-foreground/[0.06] flex">
                      <div className="flex-1 text-center py-[8px]">
                        <span className="text-[13px] font-bold text-primary block">{g.todayAnsweredCount}/{g.memberCount}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Played</span>
                      </div>
                    </div>
                  )}

                  {/* Leave — hidden until hover */}
                  <div className="px-3 pb-2 flex justify-end">
                    <button
                      onClick={() => setConfirmLeave(g.id)}
                      className="text-muted-foreground/0 group-hover/card:text-muted-foreground/30 hover:!text-destructive/60 transition-colors p-1"
                      title="Leave group"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Empty state — redesigned to match v8 card language */}
            {groups.length === 0 && !showCreate && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="bg-card rounded-[14px] border border-foreground/[0.08] p-5 text-center">
                  <div className="w-[44px] h-[44px] rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                   <p className="text-[15px] font-bold text-foreground mb-[3px]">Play JINX with your people</p>
                  <p className="text-[12px] text-muted-foreground leading-[1.5] max-w-[260px] mx-auto mb-3">
                    Create a group, answer every day, and see who thinks like you.
                  </p>
                  <Button onClick={() => setShowCreate(true)} className="w-full rounded-xl h-11 text-[13px] font-bold">
                    <Plus className="h-4 w-4 mr-1.5" /> Start a group
                  </Button>
                </div>

                <button
                  onClick={() => {
                    const code = prompt('Paste an invite link or code:');
                    if (code) {
                      const match = code.match(/\/g\/([^\s/]+)/);
                      navigate(`/g/${match ? match[1] : code.trim()}`);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-[6px] py-[10px] text-[12px] text-muted-foreground hover:text-foreground rounded-[12px] border border-dashed border-foreground/10 hover:border-foreground/20 transition-colors"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Join with an invite link
                </button>
              </motion.div>
            )}

            {showCreate && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-[14px] border border-foreground/[0.08] bg-card p-4 space-y-3"
                >
                  {needsName ? (
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-2">Set your name first</p>
                      <DisplayNameInput onSubmit={handleNameThenCreate} defaultValue="" loading={creating} />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">New group</p>
                        <button onClick={() => setShowCreate(false)} className="text-muted-foreground/30 hover:text-muted-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="e.g. Work, Family, Film friends"
                        className="rounded-lg h-10 text-sm border-foreground/[0.08]"
                        maxLength={40}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      />
                      <Button onClick={handleCreate} disabled={creating} className="w-full rounded-xl h-11 text-sm font-bold">
                        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
                      </Button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {groups.length > 0 && !showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-[6px] w-full py-3 bg-transparent border border-dashed border-foreground/10 rounded-[13px] text-[12px] text-muted-foreground cursor-pointer hover:border-foreground/20 transition-colors"
              >
                + Create new group
              </button>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
