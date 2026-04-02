import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PromptPair from '@/components/PromptPair';
import JinxLogo from '@/components/JinxLogo';
import DisplayNameInput from '@/components/DisplayNameInput';
import { getChallengeByToken, getPromptsForDate, isChallenger, type Challenge } from '@/lib/challenge';
import { getCompletedPrompts } from '@/lib/store';
import { getDisplayName, setDisplayName, joinChallengeRoom, hasJoinedRoom } from '@/lib/challenge-room';
import type { DbPrompt } from '@/lib/store';

export default function ChallengeLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid challenge link'); setLoading(false); return; }

    (async () => {
      try {
        const ch = await getChallengeByToken(token);
        if (!ch) { setError('Challenge not found'); setLoading(false); return; }
        setChallenge(ch);

        const ps = await getPromptsForDate(ch.date);
        if (ps.length === 0) { setError('Prompts no longer available'); setLoading(false); return; }
        setPrompts(ps);

        // If already joined room, check if all played
        const completed = getCompletedPrompts();
        const allPlayed = ps.every(p => completed.has(p.id));
        const alreadyJoined = await hasJoinedRoom(ch.id);

        if (allPlayed && alreadyJoined) {
          navigate(`/c/${token}/compare`, { replace: true });
          return;
        }

        // For own challenge: auto-join as challenger
        if (isChallenger(ch)) {
          const savedName = getDisplayName();
          if (savedName && !alreadyJoined) {
            await joinChallengeRoom(ch.id, savedName);
          }
          setLoading(false);
          return;
        }

        // For recipients: check if they need a display name
        if (!alreadyJoined && !getDisplayName()) {
          setNeedsName(true);
        }

        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  const handleNameSubmit = async (name: string) => {
    if (!challenge) return;
    setJoining(true);
    try {
      setDisplayName(name);
      await joinChallengeRoom(challenge.id, name);
      setNeedsName(false);

      // Check if already played
      const completed = getCompletedPrompts();
      const allPlayed = prompts.every(p => completed.has(p.id));
      if (allPlayed) {
        navigate(`/c/${token}/compare`, { replace: true });
      }
    } catch {
      // Continue anyway
      setNeedsName(false);
    }
    setJoining(false);
  };

  const handleStartChallenge = async () => {
    if (!challenge) return;
    // Ensure joined room
    const savedName = getDisplayName();
    if (savedName) {
      try {
        await joinChallengeRoom(challenge.id, savedName);
      } catch { /* continue */ }
    }
    navigate(`/play?challenge=${token}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading challenge…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground">{error}</h2>
        <p className="text-sm text-muted-foreground">This challenge link may have expired or is invalid.</p>
        <Button className="rounded-lg" asChild>
          <Link to="/">Play today's JINX</Link>
        </Button>
      </div>
    </div>
  );

  if (!challenge) return null;

  const isOwn = isChallenger(challenge);
  const today = new Date().toISOString().split('T')[0];
  const isToday = challenge.date === today;
  const dateLabel = isToday
    ? "Today's JINX"
    : new Date(challenge.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-center h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center w-full max-w-sm py-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/8 mb-6"
          >
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-display font-bold text-primary uppercase tracking-[0.12em]">
              Friend Challenge
            </span>
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">
            {isOwn ? 'Your challenge is ready' : 'Can you match your friend?'}
          </h1>

          <p className="text-sm text-muted-foreground mb-2">
            {isOwn
              ? 'Share this link with friends to see if they think like you.'
              : 'Play the same 3 prompts and compare answers instantly.'
            }
          </p>

          <p className="text-[11px] text-muted-foreground/50 font-display mb-8">{dateLabel}</p>

          {/* Prompt preview */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="game-card-elevated inline-block px-8 py-6 mb-8"
          >
            <div className="space-y-3">
              {prompts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <PromptPair wordA={p.word_a} wordB={p.word_b} size="sm" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Display name input or CTA */}
          {isOwn ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground/50">You've already played — share the link above!</p>
              <Button variant="outline" className="rounded-xl" asChild>
                <Link to="/archive">View your results</Link>
              </Button>
            </div>
          ) : needsName ? (
            <DisplayNameInput
              onSubmit={handleNameSubmit}
              defaultValue={getDisplayName() ?? ''}
              loading={joining}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button
                size="lg"
                onClick={handleStartChallenge}
                className="rounded-xl px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base active:scale-[0.97] transition-transform"
              >
                Start challenge <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </main>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
