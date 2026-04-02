import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, X, ArrowRight, Share2, Loader2, AlertCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PromptPair from '@/components/PromptPair';
import JinxLogo from '@/components/JinxLogo';
import {
  getChallengeByToken,
  getPromptsForDate,
  compareAnswers,
  buildChallengeShareText,
  isChallenger,
  type Challenge,
  type ComparisonResult,
} from '@/lib/challenge';
import { getCompletedPrompts } from '@/lib/store';
import type { DbPrompt } from '@/lib/store';
import { toast } from '@/hooks/use-toast';

function getSummary(matches: number, total: number) {
  if (matches === total) return { headline: 'Perfect JINX!', sub: `You matched on all ${total} — same wavelength`, emoji: '⚡', tone: 'best' as const };
  if (matches >= total - 1 && total >= 3) return { headline: `${matches} out of ${total}!`, sub: 'So close to a perfect JINX', emoji: '🧠', tone: 'strong' as const };
  if (matches >= 1) return { headline: `${matches} out of ${total}`, sub: matches === 1 ? 'One clean JINX' : 'Partial mind-meld', emoji: '🎯', tone: 'decent' as const };
  return { headline: 'No JINX today', sub: 'Completely different wavelengths', emoji: '💭', tone: 'miss' as const };
}

const toneStyles = {
  best: 'text-[hsl(var(--match-best))] bg-[hsl(var(--match-best)/0.08)]',
  strong: 'text-[hsl(var(--match-strong))] bg-[hsl(var(--match-strong)/0.08)]',
  decent: 'text-[hsl(var(--match-good))] bg-[hsl(var(--match-good)/0.08)]',
  miss: 'text-muted-foreground bg-muted/50',
};

export default function ChallengeCompare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }

    (async () => {
      try {
        const ch = await getChallengeByToken(token);
        if (!ch) { setError('Challenge not found'); setLoading(false); return; }
        setChallenge(ch);

        const ps = await getPromptsForDate(ch.date);
        if (ps.length === 0) { setError('Prompts not available'); setLoading(false); return; }
        setPrompts(ps);

        // Check if the user has completed all prompts
        const completed = getCompletedPrompts();
        const allPlayed = ps.every(p => completed.has(p.id));

        if (!allPlayed && !isChallenger(ch)) {
          // Redirect to play first
          navigate(`/c/${token}`, { replace: true });
          return;
        }

        const comparison = await compareAnswers(ch, ps);
        setResults(comparison);
        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Comparing answers…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground">{error}</h2>
        <Button className="rounded-lg" asChild><Link to="/">Back home</Link></Button>
      </div>
    </div>
  );

  if (!challenge) return null;

  const matchCount = results.filter(r => r.matched).length;
  const total = results.length;
  const summary = getSummary(matchCount, total);
  const isOwn = isChallenger(challenge);

  const today = new Date().toISOString().split('T')[0];
  const isToday = challenge.date === today;
  const dateLabel = isToday
    ? "Today's JINX"
    : new Date(challenge.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const handleShareChallenge = async () => {
    const text = buildChallengeShareText(prompts, challenge.token);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Challenge copied!', description: 'Share it with your friends' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <span className="text-[10px] text-muted-foreground/50 font-display">{dateLabel}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center pt-[6vh] md:pt-[8vh] pb-8 px-5">
        <div className="w-full max-w-sm mx-auto">
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="text-5xl mb-4"
            >
              {summary.emoji}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-full mb-3 ${toneStyles[summary.tone]}`}
            >
              {summary.tone === 'best' && <Zap className="h-4 w-4" />}
              <span className="font-display font-bold text-sm tracking-tight">{summary.headline}</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-sm text-muted-foreground"
            >
              {summary.sub}
            </motion.p>
          </motion.div>

          {/* Prompt cards */}
          <div className="space-y-3 mb-8">
            {results.map((r, i) => (
              <motion.div
                key={r.prompt.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.35 }}
                className={`rounded-xl border-2 overflow-hidden transition-colors ${
                  r.matched
                    ? 'border-[hsl(var(--match-best)/0.3)] bg-[hsl(var(--match-best)/0.04)]'
                    : 'border-border/60 bg-card'
                }`}
              >
                {/* Prompt header */}
                <div className="px-4 pt-3 pb-2">
                  <PromptPair wordA={r.prompt.word_a} wordB={r.prompt.word_b} size="sm" />
                </div>

                {/* Answers side by side */}
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Recipient's answer */}
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display mb-1">You</p>
                      <p className={`font-display font-bold text-base break-words ${
                        r.matched ? 'text-[hsl(var(--match-best))]' : 'text-foreground'
                      }`}>
                        {r.recipientAnswer?.raw_answer ?? '—'}
                      </p>
                    </div>
                    {/* Challenger's answer */}
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display mb-1">
                        {isOwn ? 'You' : 'Friend'}
                      </p>
                      <p className={`font-display font-bold text-base break-words ${
                        r.matched ? 'text-[hsl(var(--match-best))]' : 'text-foreground/60'
                      }`}>
                        {r.challengerAnswer.raw_answer}
                      </p>
                    </div>
                  </div>

                  {/* Match indicator */}
                  <div className="mt-2 flex justify-center">
                    {r.matched ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6 + i * 0.1, type: 'spring', stiffness: 300 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--match-best)/0.1)]"
                      >
                        <Zap className="h-3 w-3 text-[hsl(var(--match-best))]" />
                        <span className="text-[11px] font-display font-bold text-[hsl(var(--match-best))] uppercase tracking-[0.1em]">JINX</span>
                      </motion.div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50">
                        <X className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[11px] font-display font-medium text-muted-foreground/50 tracking-tight">No match</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-2.5"
          >
            <Button
              onClick={handleShareChallenge}
              className="w-full rounded-xl h-11 font-semibold text-sm active:scale-[0.97] transition-transform"
            >
              <Share2 className="h-3.5 w-3.5 mr-2" /> Challenge another friend
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-sm"
              asChild
            >
              <Link to="/archive">
                View crowd results <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-xl h-9 text-xs text-muted-foreground"
              asChild
            >
              <Link to="/">
                <Home className="h-3 w-3 mr-1.5" /> Back home
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
