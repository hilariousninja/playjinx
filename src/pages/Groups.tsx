import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import GroupFeedCard from '@/components/GroupFeedCard';
import EmojiAccentPicker from '@/components/EmojiAccentPicker';
import SampleGroupPreview from '@/components/SampleGroupPreview';
import { getMyGroups, createGroup, leaveGroup, buildGroupInviteText, type GroupWithActivity } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import DisplayNameInput from '@/components/DisplayNameInput';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity, useGroupNewCount } from '@/hooks/use-group-activity';
import { GROUP_EMOJI_PRESETS, GROUP_ACCENT_PRESETS, type GroupAccent } from '@/lib/group-visuals';
import { toast } from '@/hooks/use-toast';

function randomStarter() {
  return {
    emoji: GROUP_EMOJI_PRESETS[Math.floor(Math.random() * GROUP_EMOJI_PRESETS.length)],
    accent: GROUP_ACCENT_PRESETS[Math.floor(Math.random() * GROUP_ACCENT_PRESETS.length)] as GroupAccent,
  };
}

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
  const [personality, setPersonality] = useState<{ emoji: string; accent: GroupAccent }>(randomStarter);
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();
  const groupNewCount = useGroupNewCount();

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
      const g = await createGroup(groupName.trim() || 'My JINX group', personality);
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
    const text = buildGroupInviteText(g);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Invite link copied!' });
  };

  // Solo-magic: exactly one group AND only me in it
  const onlyGroup = groups.length === 1 ? groups[0] : null;
  const showSoloMagic = !!onlyGroup && onlyGroup.memberCount === 1;

  return (
    <div className="app-shell">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <div className="flex-1 max-w-md mx-auto px-4 pt-3 pb-6 w-full">
        {/* Header — hidden on empty state so the hero card owns the page */}
        {(groups.length > 0 || showCreate) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-[6px]">
            <div>
              <h1 className="text-[15px] font-bold text-foreground tracking-tight leading-none">Groups</h1>
              <p className="text-[10px] text-muted-foreground mt-[1px]">Same prompts, same people, every day.</p>
            </div>
            {groups.length > 0 && !showCreate && (
              <button
                onClick={() => { setPersonality(randomStarter()); setShowCreate(true); }}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            )}
          </motion.div>
        )}


        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <div className="space-y-[8px]">
            {/* Group feed cards */}
            {groups.map((g, i) => {
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
                <GroupFeedCard
                  key={g.id}
                  group={g}
                  index={i}
                  onInvite={(e) => handleInvite(e, g)}
                  onLeave={() => setConfirmLeave(g.id)}
                />
              );
            })}

            {/* Solo-magic preview + big share CTA when there's exactly one group and you're alone in it */}
            {showSoloMagic && onlyGroup && (
              <div className="pt-[8px]">
                <SampleGroupPreview
                  groupName={onlyGroup.name}
                  inviteCode={onlyGroup.invite_code}
                  inviteText={buildGroupInviteText(onlyGroup)}
                />
              </div>
            )}

            {/* Empty state */}
            {groups.length === 0 && !showCreate && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-[12px] pt-[8px]">
                <div className="bg-card rounded-[16px] border border-primary/15 p-[20px]">
                  <p className="text-[18px] font-bold text-foreground leading-[1.15] tracking-tight mb-[14px]">Play JINX with your people</p>
                  <Button
                    onClick={() => { setPersonality(randomStarter()); setShowCreate(true); }}
                    className="w-full rounded-[12px] h-[46px] text-[13px] font-bold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Start your first group
                  </Button>
                  <button
                    onClick={() => {
                      const code = prompt('Paste an invite link or code:');
                      if (code) {
                        const match = code.match(/\/g\/([^\s/]+)/);
                        navigate(`/g/${match ? match[1] : code.trim()}`);
                      }
                    }}
                    className="w-full mt-[8px] flex items-center justify-center gap-[5px] h-[34px] text-[11px] text-muted-foreground hover:text-foreground rounded-[10px] border border-dashed border-foreground/[0.1] hover:border-foreground/20 transition-colors"
                  >
                    <LinkIcon className="h-3 w-3" /> Join with invite link
                  </button>
                </div>

                {/* Static example — gives the empty state something concrete */}
                <div className="rounded-[12px] border border-dashed border-foreground/[0.1] px-[14px] py-[10px]">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70 font-semibold mb-[4px]">What it looks like</p>
                  <p className="text-[12px] text-foreground/75 leading-[1.4]">
                    <span className="font-semibold text-foreground">Sam · Maya · You</span> — <span className="text-primary font-semibold">2 jinxed</span> yesterday on <span className="italic">"mistake + river"</span>.
                  </p>
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
                  className="rounded-[14px] border border-foreground/[0.08] bg-card p-[14px] space-y-[12px]"
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
                        className="rounded-[10px] h-[40px] text-[13px] border-foreground/[0.1]"
                        maxLength={40}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      />
                      <EmojiAccentPicker
                        emoji={personality.emoji}
                        accent={personality.accent}
                        onChange={setPersonality}
                      />
                      <Button onClick={handleCreate} disabled={creating} className="w-full rounded-[12px] h-[42px] text-[13px] font-bold">
                        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create group'}
                      </Button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Join with invite link */}
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

      <MobileBottomNav
        hasNewRoomActivity={hasNewRoomActivity}
        hasGroupActivity={hasGroupActivity}
        groupNewCount={groupNewCount}
      />
    </div>
  );
}
