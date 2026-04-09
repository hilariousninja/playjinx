import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Loader2, X, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMyGroups, createGroup, buildGroupInviteText, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

interface Props {
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * "Invite to group" button.
 * - 0 groups: shows inline name input to create one.
 * - 1 group: shares invite directly.
 * - 2+ groups: shows a compact picker first.
 */
export default function InviteToGroupButton({ variant = 'outline', className = '' }: Props) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerGroups, setPickerGroups] = useState<GroupWithActivity[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareGroupInvite = async (g: { invite_code: string; name: string; id: string; creator_session_id: string; created_at: string }) => {
    const text = buildGroupInviteText(g as any);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Group invite copied!', description: `Share "${g.name}" with your friends` });
  };

  const handleClick = async () => {
    setLoading(true);
    try {
      const groups = await getMyGroups();
      if (groups.length === 0) {
        setShowCreate(true);
      } else if (groups.length === 1) {
        await shareGroupInvite(groups[0]);
      } else {
        // Multiple groups — show picker
        setPickerGroups(groups);
        setShowPicker(true);
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handlePickGroup = async (g: GroupWithActivity) => {
    setShowPicker(false);
    await shareGroupInvite(g);
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
      setShowCreate(false);
      setGroupName('');
      // Route creator into the group's today state
      navigate(`/g/${g.invite_code}/today`);
    } catch {
      toast({ title: 'Could not create group', variant: 'destructive' });
    }
    setCreating(false);
  };

  // --- Group picker ---
  if (showPicker) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5 w-full">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-display">Share which group?</p>
          <button onClick={() => setShowPicker(false)} className="text-muted-foreground/30 hover:text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {pickerGroups.slice(0, 6).map(g => (
          <button
            key={g.id}
            onClick={() => handlePickGroup(g)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-3 w-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-display font-bold text-foreground truncate">{g.name}</p>
              <p className="text-[10px] text-muted-foreground/50">{g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary/40 transition-colors shrink-0" />
          </button>
        ))}
        <button
          onClick={() => { setShowPicker(false); setShowCreate(true); }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left text-muted-foreground/50 hover:text-muted-foreground text-[11px]"
        >
          <span className="text-xs">+</span> Create new group
        </button>
      </div>
    );
  }

  // --- Create form ---
  if (showCreate) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2 w-full">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-display">Name your group</p>
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
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create & share invite'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      className={`rounded-xl active:scale-[0.97] transition-transform ${className}`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <UserPlus className="h-3 w-3 mr-1.5" />} Invite to group
    </Button>
  );
}
