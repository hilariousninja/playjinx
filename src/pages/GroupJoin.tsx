import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import DisplayNameInput from '@/components/DisplayNameInput';
import { getGroupByInviteCode, joinGroup, isMemberOf, type JinxGroup } from '@/lib/groups';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';
import { getCompletedPrompts, ensureDailyPrompts } from '@/lib/store';

export default function GroupJoin() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<JinxGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) { setError('Invalid invite link'); setLoading(false); return; }

    (async () => {
      try {
        const g = await getGroupByInviteCode(inviteCode);
        if (!g) { setError('Group not found'); setLoading(false); return; }
        setGroup(g);

        const alreadyMember = await isMemberOf(g.id);
        if (alreadyMember) {
          // Already a member — go to group view
          navigate(`/g/${inviteCode}/today`, { replace: true });
          return;
        }

        if (!getDisplayName()) {
          setNeedsName(true);
        }

        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [inviteCode, navigate]);

  const handleNameSubmit = async (name: string) => {
    setDisplayName(name);
    await handleJoin(name);
  };

  const handleJoin = async (name?: string) => {
    if (!group) return;
    setJoining(true);
    try {
      const displayName = name || getDisplayName() || 'Player';
      if (!getDisplayName()) setDisplayName(displayName);
      await joinGroup(group.id, displayName);

      // Check if they've played today
      const prompts = await ensureDailyPrompts();
      const completed = getCompletedPrompts();
      const allPlayed = prompts.every(p => completed.has(p.id));

      if (allPlayed) {
        navigate(`/g/${inviteCode}/today`, { replace: true });
      } else {
        navigate('/play', { replace: true });
      }
    } catch {
      setError('Could not join group');
    }
    setJoining(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground">{error}</h2>
        <Button className="rounded-lg" asChild>
          <Link to="/">Play today's JINX</Link>
        </Button>
      </div>
    </div>
  );

  if (!group) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/"><JinxLogo size={18} className="text-foreground text-base" /></Link>
          <PlayerIdentity />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-sm py-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/8 mb-6"
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-display font-bold text-primary uppercase tracking-[0.12em]">
              Group Invite
            </span>
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">
            Join "{group.name}"
          </h1>

          <p className="text-sm text-muted-foreground mb-8">
            Play JINX together every day and see who thinks alike.
          </p>

          {needsName ? (
            <DisplayNameInput
              onSubmit={handleNameSubmit}
              defaultValue=""
              loading={joining}
            />
          ) : (
            <Button
              size="lg"
              onClick={() => handleJoin()}
              disabled={joining}
              className="rounded-xl px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base active:scale-[0.97] transition-transform"
            >
              {joining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
              Join group <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </motion.div>
      </main>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
