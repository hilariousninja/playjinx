import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, UserPlus, Radio, Plus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMyGroups, createGroup, buildGroupInviteText, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

interface Props {
  className?: string;
  maxGroups?: number;
}

export default function ActiveGroupCard({ className = '', maxGroups = 3 }: Props) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupWithActivity[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const gs = await getMyGroups();
        if (!ignore) setGroups(gs);
      } catch {
        if (!ignore) setGroups([]);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const handleInvite = async (e: React.MouseEvent, g: GroupWithActivity) => {
    e.preventDefault();
    e.stopPropagation();
    const text = buildGroupInviteText(g as any);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Invite link copied!', description: `Share "${g.name}" with friends` });
  };

  const handleCreate = async () => {
    if (!getDisplayName()) {
      toast({ title: 'Set a display name first', description: 'Tap your name at the top to set one' });
      return;
    }
    setCreating(true);
    try {
      const name = groupName.trim() || 'My JINX group';
      const g = await createGroup(name);
      navigate(`/g/${g.invite_code}/today`);
    } catch {
      toast({ title: 'Could not create group', variant: 'destructive' });
    }
    setCreating(false);
  };

  if (groups === null) return null;

  // --- Create form ---
  if (showCreate) {
    return (
      <div className={`rounded-xl border border-border/50 bg-card p-3 space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-display">Start a group</p>
          <button onClick={() => setShowCreate(false)} className="text-muted-foreground/30 hover:text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <Input
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="e.g. Work, Family, Film friends"
          className="rounded-lg h-9 text-sm border-border/50"
          maxLength={40}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={creating} className="w-full rounded-lg h-9 text-sm">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
        </Button>
      </div>
    );
  }

  // --- No groups → compact start CTA ---
  if (groups.length === 0) {
    return (
      <button
        onClick={() => setShowCreate(true)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-dashed border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card transition-all group ${className}`}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Plus className="h-4 w-4 text-primary" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <p className="text-xs font-display font-bold text-foreground">Start a group</p>
          <p className="text-[10px] text-muted-foreground/50 leading-tight">Play daily with friends</p>
        </div>
      </button>
    );
  }

  // --- Active groups: whole card is a link, invite is a small secondary action ---
  return (
    <div className={`space-y-1.5 ${className}`}>
      {groups.slice(0, maxGroups).map(g => (
        <Link
          key={g.id}
          to={`/g/${g.invite_code}/today`}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:border-primary/20 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[13px] font-display font-bold text-foreground truncate min-w-0 flex-1">{g.name}</p>
              {g.hasActivityToday && (
                <span className="text-[7px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-display font-bold leading-none flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <Radio className="h-1.5 w-1.5" /> Live
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/50 leading-tight mt-0.5">
              {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
              {g.todayAnsweredCount > 0 && ` · ${g.todayAnsweredCount} played today`}
            </p>
          </div>
          <button
            onClick={(e) => handleInvite(e, g)}
            className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
            title="Invite to group"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        </Link>
      ))}
      {groups.length > maxGroups && (
        <Link
          to="/groups"
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground text-center block py-1 transition-colors"
        >
          View all {groups.length} groups
        </Link>
      )}
    </div>
  );
}
