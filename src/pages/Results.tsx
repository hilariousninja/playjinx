import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import {
  ensureDailyPrompts, getUserAnswer, getStats, getCanonicalAnswer,
  getTotalSubmissions, type DbPrompt, type DbAnswer, type AnswerStat,
} from '@/lib/store';
import { createChallenge, buildChallengeShareText } from '@/lib/challenge';
import { syncJinxesFromResults, getJinxTotal, getJinxesThisWeek, isRealJinx, isProvisionalLead } from '@/lib/jinx-tracker';
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

      // Sync jinxes — only true crowd matches count
      syncJinxesFromResults(res.map(r => ({
        promptId: r.prompt.id,
        date: r.prompt.date,
        rank: r.rank,
        matchCount: r.matchCount,
      })));

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
  const jinxes = answered.filter(r => isRealJinx(r.rank, r.matchCount)).length;
  const provisionalLeads = answered.filter(r => isProvisionalLead(r.rank, r.matchCount)).length;
  const totalJinxes = getJinxTotal();
  const weekJinxes = getJinxesThisWeek();

  const bestResult = answered.length > 0
    ? answered.reduce((best, r) => (r.percentage > best.percentage ? r : best), answered[0])
    : null;

  const maxTotal = Math.max(...answered.map(r => r.total), 0);
  const lowSample = maxTotal > 0 && maxTotal < 10;

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

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader
        hasNewRoomActivity={hasNewRoomActivity}
        hasGroupActivity={hasGroupActivity}
        rightContent={<span className="text-[11px] text-muted-foreground">{dateLabel}</span>}
      />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-8 space-y-3">
        {/* Brag block */}
        <BragBlock
          answeredCount={answered.length}
          totalCount={results.length}
          vibeLabel=""
          vibeColor=""
          bestAnswer={bestResult?.answer?.raw_answer}
          bestPct={bestResult?.percentage}
          topPicks={jinxes}
        />

        {/* JINX reward moment — only for real crowd matches */}
        {jinxes > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between bg-primary/8 rounded-[11px] px-[14px] py-[10px]"
          >
            <div className="flex items-center gap-[8px]">
              <span className="text-[16px] font-bold text-primary">✕ {jinxes}</span>
              <span className="text-[12px] text-foreground/70 font-medium">
                {jinxes === results.length ? 'Perfect JINX day!' : `JINX${jinxes > 1 ? 'es' : ''} today`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block">{totalJinxes} total · {weekJinxes} this week</span>
            </div>
          </motion.div>
        )}

        {/* Provisional lead — top answer but no overlap yet */}
        {jinxes === 0 && provisionalLeads > 0 && (
          <div className="flex items-center gap-[8px] bg-foreground/[0.04] rounded-[11px] px-[14px] py-[10px]">
            <span className="text-[14px]">⏳</span>
            <span className="text-[11px] text-foreground/65 leading-[1.4]">
              Leading so far on {provisionalLeads} {provisionalLeads === 1 ? 'prompt' : 'prompts'} — JINX confirms when others match.
            </span>
          </div>
        )}

        {/* Low sample warning */}
        {lowSample && jinxes === 0 && provisionalLeads === 0 && (
          <div className="flex items-center gap-[6px] bg-primary/8 rounded-[10px] px-3 py-[8px]">
            <span className="text-[12px]">🌱</span>
            <span className="text-[11px] text-foreground/60 leading-[1.4]">
              Early results — only {maxTotal} {maxTotal === 1 ? 'player' : 'players'} so far. Rankings may shift as more people answer.
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex bg-card rounded-[11px] border border-foreground/[0.08] overflow-hidden">
          {[
            { value: `✕ ${jinxes}`, label: 'JINXes' },
            { value: bestResult ? `Top ${Math.max(bestResult.percentage, 1)}%` : '—', label: 'Best result' },
            { value: answered.reduce((s, r) => s + r.stats.length, 0), label: 'Unique answers' },
          ].map((s, i) => (
            <div key={s.label} className={`flex-1 text-center py-[9px] px-1 ${i > 0 ? 'border-l border-foreground/[0.08]' : ''}`}>
              <span className="text-[14px] font-bold text-primary block mb-px">{s.value}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Section label */}
        <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mt-1 mb-0">
          How the crowd voted
        </p>

        {/* Per-prompt result cards */}
        {results.map((r, i) => {
          const barWidth = r.total > 0 && r.matchCount > 0
            ? Math.max(Math.round((r.matchCount / r.total) * 100), 4) : 0;
          const topStat = r.stats[0];
          const isJinx = isRealJinx(r.rank, r.matchCount);
          const isLeading = isProvisionalLead(r.rank, r.matchCount);
          const borderClass = isJinx ? 'border-l-[3px] border-l-[hsl(var(--success))]'
            : r.rank === 2 ? 'border-l-[3px] border-l-primary'
            : 'border-l-[3px] border-l-border';
          const badgeCls = isJinx ? 'bg-[hsl(var(--success))]/10 text-[hsl(142_72%_30%)]'
            : r.rank === 2 ? 'bg-primary/10 text-[hsl(var(--warning-foreground))]'
            : 'bg-muted text-muted-foreground';
          const barCls = isJinx ? 'bg-[hsl(var(--success))]/10'
            : r.rank === 2 ? 'bg-primary/10'
            : 'bg-foreground/[0.06]';

          return (
            <motion.div
              key={r.prompt.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`bg-card rounded-[12px] border border-foreground/[0.08] p-[11px_12px] ${borderClass}`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-[5px]">
                <span className="text-[11px] font-medium text-muted-foreground tracking-[0.04em]">
                  {r.prompt.word_a} + {r.prompt.word_b}
                </span>
                <div className="flex items-center gap-[4px]">
                  {isJinx && <span className="text-[10px] font-bold text-primary" aria-label="JINX">✕</span>}
                  {isLeading && <span className="text-[9px] font-medium text-muted-foreground/70 italic">leading</span>}
                  <span className={`text-[10px] font-semibold px-[6px] py-[2px] rounded-[6px] ${badgeCls}`}>
                    #{r.rank} · {r.percentage}%
                  </span>
                </div>
              </div>

              {r.answer ? (
                <>
                  <div className="flex items-center gap-[5px] mb-[6px]">
                    <span className="text-[17px] font-bold text-foreground">
                      {r.answer.raw_answer}
                    </span>
                    <span className="text-[9px] font-semibold bg-primary text-white px-[5px] py-[2px] rounded">
                      you
                    </span>
                  </div>

                  <div className="h-[18px] bg-muted/40 rounded-[5px] overflow-hidden mb-[3px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.05 }}
                      className={`h-full rounded-[5px] flex items-center px-[7px] ${barCls}`}
                    >
                      <span className={`text-[10px] font-semibold ${
                        isJinx ? 'text-[hsl(142_72%_30%)]' : r.rank === 2 ? 'text-[hsl(var(--warning-foreground))]' : 'text-muted-foreground'
                      }`}>
                        {r.userCanonical || r.answer.normalized_answer}
                      </span>
                    </motion.div>
                  </div>

                  <p className="text-[10px] text-muted-foreground mb-[5px]">
                    {r.percentage}% · {isJinx ? 'JINX!' : isLeading ? 'leading so far — needs another match' : topStat ? `top was "${topStat.normalized_answer}" (${topStat.percentage}%)` : ''}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground/40 mb-[5px] italic">Missed</p>
              )}

              <button
                onClick={() => setDrawerPrompt(r)}
                className="w-full bg-transparent border-none border-t border-foreground/[0.08] pt-[7px] text-[11px] text-primary font-medium cursor-pointer text-left flex items-center justify-between"
              >
                <span>{r.stats.length} answers</span>
                <span>→</span>
              </button>
            </motion.div>
          );
        })}

        {/* Bottom CTAs */}
        <div className="space-y-[10px] pt-[14px]">
          <button
            onClick={handleShare}
            className="w-full py-[13px] bg-primary text-white border-none rounded-[12px] text-[14px] font-semibold cursor-pointer active:scale-[0.97] transition-transform"
          >
            Share results
          </button>

          <button
            onClick={handleChallenge}
            className="block w-full text-center text-[12px] text-muted-foreground py-1 cursor-pointer"
          >
            <span className="text-primary font-medium">Challenge a friend →</span>
          </button>

          <Countdown />
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
