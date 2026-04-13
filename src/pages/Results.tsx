import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, ChevronRight, Trophy, Target, TrendingUp, Sparkles, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ensureDailyPrompts, getUserAnswer, getStats, getCanonicalAnswer,
  getTotalSubmissions, type DbPrompt, type DbAnswer, type AnswerStat,
} from '@/lib/store';
import { createChallenge, buildChallengeShareText } from '@/lib/challenge';
import Countdown from '@/components/Countdown';
import BragBlock from '@/components/BragBlock';
import AnswerDrawer from '@/components/AnswerDrawer';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import { toast } from '@/hooks/use-toast';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';

interface PromptResult {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  stats: AnswerStat[];
  total: number;
  rank: number;
  matchCount: number;
  percentage: number;
  userCanonical: string | null;
}

export default function Results() {
  const navigate = useNavigate();
  const [results, setResults] = useState<PromptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerPrompt, setDrawerPrompt] = useState<PromptResult | null>(null);
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();

  useEffect(() => {
    (async () => {
      const prompts = await ensureDailyPrompts();
      const res: PromptResult[] = await Promise.all(
        prompts.map(async (prompt) => {
          const [answer, stats, total] = await Promise.all([
            getUserAnswer(prompt.id),
            getStats(prompt.id),
            getTotalSubmissions(prompt.id),
          ]);

          let rank = 0, matchCount = 0, percentage = 0;
          let userCanonical: string | null = null;

          if (answer) {
            const canon = await getCanonicalAnswer(answer.normalized_answer);
            let userStat = stats.find(s => s.normalized_answer === canon);
            if (!userStat) {
              const { levenshtein } = await import('@/lib/normalize');
              userStat = stats.find(s => {
                const dist = levenshtein(canon, s.normalized_answer);
                return s.normalized_answer.length > 3 && dist <= (s.normalized_answer.length >= 10 ? 2 : 1);
              });
            }
            userCanonical = userStat?.normalized_answer ?? canon;
            rank = userStat?.rank ?? 0;
            matchCount = userStat?.count ?? 0;
            percentage = userStat?.percentage ?? 0;
          }

          return { prompt, answer, stats, total, rank, matchCount, percentage, userCanonical };
        })
      );

      if (res.every(r => !r.answer)) {
        navigate('/play', { replace: true });
        return;
      }

      setResults(res);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
    </div>
  );

  const answered = results.filter(r => r.answer);
  const topPicks = answered.filter(r => r.rank === 1).length;
  const bestResult = answered.length > 0
    ? answered.reduce((best, r) => (r.percentage > best.percentage ? r : best), answered[0])
    : null;

  const avgRank = answered.length > 0 ? answered.reduce((s, r) => s + r.rank, 0) / answered.length : 0;
  const vibe = avgRank <= 1.5 ? { label: 'Strong crowd read', color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' }
    : avgRank <= 3 ? { label: 'Solid instincts', color: 'text-primary', bg: 'bg-primary/10' }
    : { label: 'Unique thinker', color: 'text-muted-foreground', bg: 'bg-muted' };

  const handleShare = async () => {
    const prompts = results.map(r => r.prompt);
    try {
      const ch = await createChallenge(prompts);
      const text = buildChallengeShareText(prompts, ch.token);
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch {}
      }
      await navigator.clipboard.writeText(text);
      toast({ title: 'Results copied!', description: 'Share them with friends' });
    } catch {
      toast({ title: 'Could not share', variant: 'destructive' });
    }
  };

  const handleChallenge = async () => {
    const prompts = results.map(r => r.prompt);
    try {
      const ch = await createChallenge(prompts);
      const text = buildChallengeShareText(prompts, ch.token);
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch {}
      }
      await navigator.clipboard.writeText(text);
      toast({ title: 'Challenge copied!', description: 'Send it to a friend' });
    } catch {
      toast({ title: 'Could not create challenge', variant: 'destructive' });
    }
  };

  const getTierInfo = (rank: number, matchCount: number) => {
    if (rank === 1) return { label: '#1', color: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]', icon: Trophy };
    if (rank === 2) return { label: '#2', color: 'bg-primary/12 text-primary', icon: Target };
    if (rank <= 4) return { label: `#${rank}`, color: 'bg-muted text-muted-foreground', icon: TrendingUp };
    if (matchCount > 1) return { label: `#${rank}`, color: 'bg-muted text-muted-foreground', icon: Sparkles };
    return { label: 'Unique', color: 'bg-muted text-muted-foreground', icon: Minus };
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <div className="flex-1 max-w-md mx-auto w-full px-5 pt-6 pb-8 space-y-4">
        {/* Brag block */}
        <BragBlock
          answeredCount={answered.length}
          totalCount={results.length}
          vibeLabel={vibe.label}
          vibeColor={vibe.color}
          bestAnswer={bestResult?.answer?.raw_answer}
          bestPct={bestResult?.percentage}
          topPicks={topPicks}
        />

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          {[
            { value: topPicks, label: 'top picks' },
            { value: answered.length > 0 ? Math.max(...answered.map(r => r.total)) : 0, label: 'players today' },
            { value: answered.length > 0 ? answered.reduce((s, r) => s + r.stats.length, 0) : 0, label: 'unique answers' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/60 rounded-xl py-3">
              <p className="text-xl font-black text-foreground tracking-tight">{s.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-display uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Per-prompt cards */}
        {results.map((r, i) => {
          const tier = getTierInfo(r.rank, r.matchCount);
          const TierIcon = tier.icon;
          const barWidth = r.total > 0 && r.matchCount > 0
            ? Math.max(Math.round((r.matchCount / r.total) * 100), 4)
            : 0;

          return (
            <motion.div
              key={r.prompt.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-card border border-border/60 rounded-xl p-4"
            >
              <p className="text-[9px] font-display text-muted-foreground/40 uppercase tracking-wider mb-2.5">
                {r.prompt.word_a} + {r.prompt.word_b}
              </p>

              {r.answer ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-foreground tracking-tight">
                        {r.answer.raw_answer}
                      </span>
                      <span className="text-[8px] text-primary font-bold uppercase tracking-wider bg-primary/8 px-1.5 py-0.5 rounded">You</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${tier.color}`}>
                      <TierIcon className="h-2.5 w-2.5" />
                      {tier.label}
                    </span>
                  </div>

                  <div className="relative h-7 rounded-lg bg-muted/40 overflow-hidden mb-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.05 }}
                      className="absolute inset-y-0 left-0 rounded-lg bg-primary/25"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-display font-bold text-foreground/50">
                      {r.percentage}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground/40 mb-2.5 font-medium">Missed</p>
              )}

              <button
                onClick={() => setDrawerPrompt(r)}
                className="flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
              >
                See all {r.stats.length} answers <ChevronRight className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}

        {/* Bottom CTAs */}
        <div className="space-y-3 pt-3">
          <Button
            onClick={handleShare}
            size="lg"
            className="w-full rounded-xl h-[52px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[15px] active:scale-[0.97] transition-transform shadow-sm shadow-primary/20"
          >
            <Share2 className="h-4 w-4 mr-2" /> Share your results
          </Button>

          <button
            onClick={handleChallenge}
            className="w-full text-center text-sm text-primary font-bold hover:underline py-2"
          >
            Challenge a friend →
          </button>

          <div className="pt-1">
            <Countdown />
          </div>
        </div>
      </div>

      <AnswerDrawer
        open={!!drawerPrompt}
        onClose={() => setDrawerPrompt(null)}
        promptResult={drawerPrompt}
      />

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}