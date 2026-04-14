import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Loader2, LogOut, LinkIcon, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import { getMyGroups, createGroup, leaveGroup, buildGroupInviteText, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import DisplayNameInput from '@/components/DisplayNameInput';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';
import { toast } from '@/hooks/use-toast';

const AVATAR_COLORS = [
  { bg: 'bg-primary/15', text: 'text-primary', accent: 'border-primary/20' },
  { bg: 'bg-[hsl(var(--info))]/12', text: 'text-[hsl(var(--info))]', accent: 'border-[hsl(var(--info))]/20' },
  { bg: 'bg-[hsl(var(--success))]/12', text: 'text-[hsl(var(--success))]', accent: 'border-[hsl(var(--success))]/20' },
  { bg: 'bg-muted', text: 'text-muted-foreground', accent: 'border-foreground/10' },
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

  const handleInvite = async (e: React.MouseEvent, g: GroupWithActivity) => {
    e.preventDefault();
    e.stopPropagation();
    const text = buildGroupInviteText(g as any);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Invite link copied!' });
  };

  const getActivity = (g: GroupWithActivity) => {
    if (g.memberCount === 1) return { type: 'solo' as const, emoji: '👋', label: 'Just you — invite someone', color: 'text-primary', bg: 'bg-primary/6' };
    if (g.todayAnsweredCount === 0) return { type: 'quiet' as const, emoji: '💤', label: "Nobody's played yet", color: 'text-muted-foreground', bg: 'bg-muted/60' };
    if (g.todayAnsweredCount < g.memberCount) {
      const waiting = g.memberCount - g.todayAnsweredCount;
      return { type: 'waiting' as const, emoji: '⏳', label: `${g.todayAnsweredCount} played · ${waiting} to go`, color: 'text-foreground/70', bg: 'bg-primary/8' };
    }
    return { type: 'complete' as const, emoji: '✓', label: 'Everyone played!', color: 'text-[hsl(var(--success))] font-medium', bg: 'bg-[hsl(var(--success))]/8' };
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <div className="flex-1 max-w-md mx-auto px-4 pt-3 pb-6 w-full">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-[6px]">
          <div>
            <h1 className="text-[15px] font-bold text-foreground tracking-tight leading-none">Groups</h1>
            <p className="text-[10px] text-muted-foreground mt-[1px]">Same prompts, same people, every day.</p>
          </div>
          {groups.length > 0 && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          )}
        </motion.div>

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <div className="space-y-[5px]">
            {/* Group cards */}
            {groups.map((g, i) => {
              const activity = getActivity(g);
              const colorSet = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const initials = g.name.substring(0, 2).toUpperCase();

              if (confirmLeave === g.id) {
                return (
                  <div key={g.id} className="flex items-center gap-2 px-3 py-[10px] rounded-[12px] border border-destructive/30 bg-card">
                    <p className="text-[12px] text-muted-foreground flex-1 truncate">
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
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-[12px] border border-foreground/[0.08] overflow-hidden group/card"
                >
                  <Link
                    to={`/g/${g.invite_code}/today`}
                    className="block px-[12px] pt-[10px] pb-[8px] hover:bg-accent/30 transition-colors"
                  >
                    {/* Top row: avatar + name + members + arrow */}
                    <div className="flex items-center gap-[9px]">
                      <div className={`w-[32px] h-[32px] rounded-full ${colorSet.bg} border ${colorSet.accent} flex items-center justify-center shrink-0`}>
                        <span className={`text-[11px] font-bold ${colorSet.text}`}>{initials}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[6px]">
                          <p className="text-[13px] font-bold text-foreground truncate leading-tight">{g.name}</p>
                          {activity.type === 'complete' && (
                            <span className="text-[8px] bg-[hsl(var(--success))]/12 text-[hsl(var(--success))] px-[5px] py-[1px] rounded-full font-bold leading-none shrink-0">
                              All in
                            </span>
                          )}
                          {activity.type === 'waiting' && (
                            <span className="text-[8px] bg-primary/10 text-primary px-[5px] py-[1px] rounded-full font-bold leading-none shrink-0">
                              Live
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-[1px]">
                          {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      <svg className="h-3 w-3 text-muted-foreground/25 shrink-0" viewBox="0 0 12 12" fill="none">
                        <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    {/* Activity strip — tight, inline */}
                    <div className={`mt-[7px] rounded-[8px] px-[9px] py-[6px] flex items-center gap-[6px] ${activity.bg}`}>
                      <span className="text-[11px] shrink-0 leading-none">{activity.emoji}</span>
                      <span className={`text-[11px] leading-[1.3] flex-1 ${activity.color}`}>
                        {activity.label}
                      </span>
                      {activity.type === 'solo' && (
                        <span className="text-[10px] text-primary font-semibold whitespace-nowrap">Invite →</span>
                      )}
                      {activity.type === 'quiet' && (
                        <span className="text-[10px] text-primary/70 font-medium whitespace-nowrap">Nudge →</span>
                      )}
                    </div>
                  </Link>

                  {/* Bottom bar: stats + actions */}
                  <div className="flex items-center px-[12px] py-[6px] border-t border-foreground/[0.04]">
                    {g.memberCount > 1 && (
                      <span className="text-[10px] text-muted-foreground/50">
                        <span className="font-bold text-foreground/60">{g.todayAnsweredCount}/{g.memberCount}</span> today
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={(e) => handleInvite(e, g)}
                      className="p-[4px] rounded-md text-muted-foreground/25 hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Invite"
                    >
                      <UserPlus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setConfirmLeave(g.id)}
                      className="p-[4px] rounded-md text-muted-foreground/0 group-hover/card:text-muted-foreground/20 hover:!text-destructive/50 transition-colors ml-[2px]"
                      title="Leave group"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Empty state */}
            {groups.length === 0 && !showCreate && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-[6px]">
                <div className="bg-card rounded-[12px] border border-foreground/[0.08] p-[14px]">
                  <div className="flex items-center gap-[10px] mb-[10px]">
                    <div className="w-[32px] h-[32px] rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-[15px] w-[15px] text-primary" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground leading-tight">Play JINX with your people</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-[1px]">Same prompts · see who thinks like you</p>
                    </div>
                  </div>
                  <div className="flex gap-[6px]">
                    <Button onClick={() => setShowCreate(true)} className="flex-1 rounded-[10px] h-[36px] text-[12px] font-bold">
                      <Plus className="h-3 w-3 mr-1" /> Start a group
                    </Button>
                    <button
                      onClick={() => {
                        const code = prompt('Paste an invite link or code:');
                        if (code) {
                          const match = code.match(/\/g\/([^\s/]+)/);
                          navigate(`/g/${match ? match[1] : code.trim()}`);
                        }
                      }}
                      className="flex items-center gap-[4px] px-[12px] h-[36px] text-[11px] text-muted-foreground hover:text-foreground rounded-[10px] border border-foreground/[0.08] hover:border-foreground/15 transition-colors shrink-0"
                    >
                      <LinkIcon className="h-3 w-3" />
                      Join
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Create form */}
            {showCreate && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-[12px] border border-foreground/[0.08] bg-card p-[12px] space-y-[8px]"
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
                        className="rounded-[8px] h-[38px] text-[13px] border-foreground/[0.08]"
                        maxLength={40}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      />
                      <Button onClick={handleCreate} disabled={creating} className="w-full rounded-[10px] h-[40px] text-[13px] font-bold">
                        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
                      </Button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Add group button when groups exist */}
            {groups.length > 0 && !showCreate && (
              <button
                onClick={() => {
                  const code = prompt('Paste an invite link or code:');
                  if (code) {
                    const match = code.match(/\/g\/([^\s/]+)/);
                    navigate(`/g/${match ? match[1] : code.trim()}`);
                  }
                }}
                className="flex items-center justify-center gap-[5px] w-full py-[8px] text-[11px] text-muted-foreground/50 hover:text-muted-foreground rounded-[10px] border border-dashed border-foreground/[0.06] hover:border-foreground/15 transition-colors"
              >
                <LinkIcon className="h-3 w-3" />
                Join with invite link
              </button>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
