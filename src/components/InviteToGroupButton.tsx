import { useState } from 'react';
import { UserPlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMyGroups, createGroup, buildGroupInviteText, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

interface Props {
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * "Invite to group" button.
 * - If groups exist, shares invite for the most recent one.
 * - If no groups, shows inline name input to create one intentionally.
 */
export default function InviteToGroupButton({ variant = 'outline', className = '' }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const shareGroupInvite = async (g: { invite_code: string; name: string; id: string; creator_session_id: string; created_at: string }) => {
    const text = buildGroupInviteText(g as any);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Group invite copied!', description: `Share "${g.name}" with your friends` });
  };

  const handleClick = async () => {
    try {
      const groups = await getMyGroups();
      if (groups.length > 0) {
        await shareGroupInvite(groups[0]);
      } else {
        // Show creation form instead of auto-creating
        setShowCreate(true);
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
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
      await shareGroupInvite(g);
    } catch {
      toast({ title: 'Could not create group', variant: 'destructive' });
    }
    setCreating(false);
  };

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
    >
      <UserPlus className="h-3 w-3 mr-1.5" /> Invite to group
    </Button>
  );
}
