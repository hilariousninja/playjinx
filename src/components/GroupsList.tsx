import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Loader2, Radio, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMyGroups, createGroup, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import DisplayNameInput from '@/components/DisplayNameInput';
import { toast } from '@/hooks/use-toast';

export default function GroupsList() {
  const [groups, setGroups] = useState<GroupWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [needsName, setNeedsName] = useState(false);

  useEffect(() => {
    (async () => {
      const gs = await getMyGroups();
      setGroups(gs);
      setLoading(false);
    })();
  }, []);

  const handleCreate = async () => {
    if (!getDisplayName()) {
      setNeedsName(true);
      return;
    }
    setCreating(true);
    try {
      const g = await createGroup(groupName || 'My JINX group');
      toast({ title: 'Group created!', description: `Share the invite to get started` });
      // Refresh
      const gs = await getMyGroups();
      setGroups(gs);
      setShowCreate(false);
      setGroupName('');
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

  if (loading) return null;

  // No groups and not creating — show nothing (landing page handles empty state)
  if (groups.length === 0 && !showCreate) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => setShowCreate(true)}
          className="w-full rounded-xl h-9 text-xs border-dashed border-border/50 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3 mr-1.5" /> Create a group
        </Button>
      </div>
    );
  }

  // Limit display to 4 most relevant groups
  const displayGroups = groups.slice(0, 4);
  const hasMore = groups.length > 4;

  return (
    <div className="space-y-2">
      {/* Group chips */}
      {displayGroups.map((g) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link
            to={`/g/${g.invite_code}/today`}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-display font-bold text-foreground truncate">{g.name}</p>
                {/* Only show "New" if genuinely new activity from others */}
                {g.hasActivityToday && (
                  <span className="text-[7px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-display font-bold leading-none">
                    New
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
                {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                {g.todayAnsweredCount > 1 && ` · ${g.todayAnsweredCount} played today`}
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors shrink-0" />
          </Link>
        </motion.div>
      ))}

      {hasMore && (
        <p className="text-[10px] text-muted-foreground/30 text-center">+{groups.length - 4} more groups</p>
      )}

      {/* Create button */}
      {!showCreate ? (
        <Button
          variant="ghost"
          onClick={() => setShowCreate(true)}
          className="w-full h-8 text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
        >
          <Plus className="h-3 w-3 mr-1" /> New group
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5"
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
                  placeholder="Group name (e.g. Work, Family)"
                  className="rounded-lg h-9 text-sm border-border/50"
                  maxLength={40}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full rounded-lg h-9 text-sm"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
                </Button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
