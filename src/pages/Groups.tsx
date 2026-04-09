import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Loader2, ArrowRight, LogOut, Radio, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/AppHeader';
import { getMyGroups, createGroup, leaveGroup, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import DisplayNameInput from '@/components/DisplayNameInput';
import { toast } from '@/hooks/use-toast';

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
  const [joinCode, setJoinCode] = useState('');

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

  const handleJoinByLink = () => {
    const trimmed = joinCode.trim();
    if (!trimmed) return;
    // Extract invite code from full URL or just code
    const match = trimmed.match(/\/g\/([^\s/]+)/);
    const code = match ? match[1] : trimmed;
    navigate(`/g/${code}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <div className="flex-1">
        <div className="max-w-sm mx-auto px-5 pt-6 pb-10 w-full">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-lg font-bold tracking-tight text-foreground mb-0.5">Your Groups</h1>
            <p className="text-[12px] text-muted-foreground/70 mb-5">Play JINX with the same people each day</p>
          </motion.div>

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {confirmLeave === g.id ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-card">
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
                  ) : (
                    <div className="flex items-center gap-0 group/card">
                      <Link
                        to={`/g/${g.invite_code}/today`}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-all group flex-1 min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-display font-bold text-foreground truncate">{g.name}</p>
                            {g.hasActivityToday && (
                              <span className="text-[7px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-display font-bold leading-none flex items-center gap-0.5">
                                <Radio className="h-1.5 w-1.5" /> Live
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 leading-tight mt-0.5">
                            {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                            {g.todayAnsweredCount > 0 && ` · ${g.todayAnsweredCount} played today`}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors shrink-0" />
                      </Link>
                      <button
                        onClick={() => setConfirmLeave(g.id)}
                        className="ml-1 p-1.5 rounded-lg text-muted-foreground/0 group-hover/card:text-muted-foreground/30 hover:!text-destructive/60 transition-colors shrink-0"
                        title="Leave group"
                      >
                        <LogOut className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Empty state */}
              {groups.length === 0 && !showCreate && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-foreground mb-1">No groups yet</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[15rem] mx-auto">
                      Create a group for friends, family, or coworkers — then play JINX together every day without sharing a new link.
                    </p>
                  </div>
                  <div className="space-y-2 max-w-[14rem] mx-auto">
                    <Button onClick={() => setShowCreate(true)} className="w-full rounded-xl h-9 px-6 text-sm font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Start a group
                    </Button>
                    <button
                      onClick={() => {
                        const code = prompt('Paste an invite link or code:');
                        if (code) {
                          const match = code.match(/\/g\/([^\s/]+)/);
                          navigate(`/g/${match ? match[1] : code.trim()}`);
                        }
                      }}
                      className="w-full text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1.5"
                    >
                      <LinkIcon className="h-3 w-3 inline mr-1" />
                      Join with an invite link
                    </button>
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
                    className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
                  >
                    {needsName ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground/50 mb-2">Set your name first</p>
                        <DisplayNameInput onSubmit={handleNameThenCreate} defaultValue="" loading={creating} />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-display">New group</p>
                          <button onClick={() => setShowCreate(false)} className="text-muted-foreground/30 hover:text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          value={groupName}
                          onChange={e => setGroupName(e.target.value)}
                          placeholder="e.g. Work, Family, Film friends"
                          className="rounded-lg h-10 text-sm border-border/50"
                          maxLength={40}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <Button onClick={handleCreate} disabled={creating} className="w-full rounded-lg h-10 text-sm">
                          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
                        </Button>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* New group button when groups exist */}
              {groups.length > 0 && !showCreate && (
                <Button
                  variant="outline"
                  onClick={() => setShowCreate(true)}
                  className="w-full rounded-xl h-10 text-xs border-dashed border-border/50 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3 mr-1.5" /> Create new group
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
