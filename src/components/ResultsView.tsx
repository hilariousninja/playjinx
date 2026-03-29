import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Target, Sparkles, TrendingUp, Minus } from 'lucide-react';
import { getStats, getUserAnswer, getPromptById, getTotalSubmissions, getCanonicalAnswer, type AnswerStat, type DbPrompt, type DbAnswer } from '@/lib/store';

interface Props {
  promptId: string;
}

type MatchTier = 'best' | 'strong' | 'good' | 'decent' | 'unique';

function getMatchTier(isTopAnswer: boolean, rank: number, matchCount: number): MatchTier {
  if (isTopAnswer) return 'best';
  if (rank <= 2) return 'strong';
  if (rank <= 4) return 'good';
  if (matchCount > 1) return 'decent';
  return 'unique';
}

const tierConfig: Record<MatchTier, { label: string; icon: typeof Trophy; color: string; bg: string; barColor: string }> = {
  best: {
    label: 'Strongest hit',
    icon: Trophy,
    color: 'text-[hsl(var(--match-best))]',
    bg: 'bg-[hsl(var(--match-best)/0.08)]',
    barColor: 'bg-[hsl(var(--match-best)/0.5)]',
  },
  strong: {
    label: 'Strong match',
    icon: Target,
    color: 'text-[hsl(var(--match-strong))]',
    bg: 'bg-[hsl(var(--match-strong)/0.08)]',
    barColor: 'bg-[hsl(var(--match-strong)/0.4)]',
  },
  good: {
    label: 'Good match',
    icon: TrendingUp,
    color: 'text-[hsl(var(--match-good))]',
    bg: 'bg-[hsl(var(--match-good)/0.08)]',
    barColor: 'bg-[hsl(var(--match-good)/0.35)]',
  },
  decent: {
    label: 'Decent match',
    icon: Sparkles,
    color: 'text-[hsl(var(--match-decent))]',
    bg: 'bg-[hsl(var(--match-decent)/0.08)]',
    barColor: 'bg-[hsl(var(--match-decent)/0.35)]',
  },
  unique: {
    label: 'One of a kind',
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    barColor: 'bg-muted-foreground/15',
  },
};

export default function ResultsView({ promptId }: Props) {
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [prompt, setPrompt] = useState<DbPrompt | null>(null);
  const [userAnswer, setUserAnswer] = useState<DbAnswer | null>(null);
  const [userCanonical, setUserCanonical] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, p, ua, t] = await Promise.all([
      getStats(promptId),
      getPromptById(promptId),
      getUserAnswer(promptId),
      getTotalSubmissions(promptId),
    ]);
    setStats(s);
    setPrompt(p);
    setUserAnswer(ua);
    setTotal(t);
    if (ua) {
      const canon = await getCanonicalAnswer(ua.normalized_answer);
      const exactMatch = s.find(st => st.normalized_answer === canon);
      if (exactMatch) {
        setUserCanonical(canon);
      } else {
        const { levenshtein } = await import('@/lib/normalize');
        const fuzzyMatch = s.find(st => {
          const dist = levenshtein(canon, st.normalized_answer);
          const minLen = Math.min(canon.length, st.normalized_answer.length);
          if (minLen <= 3) return false;
          if (minLen <= 5) return dist <= 1;
          if (minLen <= 9) return dist <= 2;
          return dist <= 2;
        });
        setUserCanonical(fuzzyMatch?.normalized_answer ?? canon);
      }
    } else {
      setUserCanonical(null);
    }
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return (
    <div className="text-center py-6">
      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
      <p className="text-[11px] text-muted-foreground/50">Loading results…</p>
    </div>
  );

  const unique = stats.length;
  const userStat = userCanonical ? stats.find(s => s.normalized_answer === userCanonical) : undefined;
  const topAnswer = stats.length > 0 ? stats[0] : null;
  const rank = userStat?.rank ?? 0;
  const matchCount = userStat?.count ?? 0;
  const isTopAnswer = !!(topAnswer && userCanonical && topAnswer.normalized_answer === userCanonical);
  const tier = getMatchTier(isTopAnswer, rank, matchCount);
  const config = tierConfig[tier];
  const TierIcon = config.icon;

  const getSupportingLine = () => {
    if (isTopAnswer) return `${matchCount} of ${total} players said this`;
    if (matchCount > 1) return `${matchCount} of ${total} players matched`;
    return `${total} players answered`;
  };

  return (
    <div className="space-y-5">
      {/* ── Match Badge + Hero Answer ── */}
      {userStat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          {/* Tier badge */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${config.bg} mb-4`}
          >
            <TierIcon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className={`text-[11px] font-display font-bold uppercase tracking-[0.12em] ${config.color}`}>
              {config.label}
            </span>
          </motion.div>

          {/* Hero answer */}
          <motion.p
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.14, duration: 0.3 }}
            className="font-display text-[32px] font-bold text-foreground break-words mb-1.5 leading-tight"
          >
            {userAnswer?.raw_answer}
          </motion.p>

          {/* Supporting line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="text-[12px] text-muted-foreground/60 font-display"
          >
            {getSupportingLine()}
            {!isTopAnswer && rank > 0 && (
              <span className="ml-1.5 text-foreground/40 font-bold">#{rank}</span>
            )}
          </motion.p>
        </motion.div>
      )}

      {/* ── Most Popular (if different) ── */}
      {topAnswer && !isTopAnswer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em]">
            <Crown className="h-3 w-3 text-[hsl(var(--match-decent))]" />
            Most popular
          </div>
          <p className="font-display text-base font-bold text-foreground/60 mt-0.5 break-words">
            {topAnswer.normalized_answer}
            <span className="text-[11px] font-normal text-muted-foreground/35 ml-1.5">{topAnswer.percentage}%</span>
          </p>
        </motion.div>
      )}

      {/* ── Answer Distribution ── */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-[10px] text-muted-foreground/35 uppercase tracking-[0.15em] mb-3 font-medium">Top answers</p>
        <div className="space-y-1">
          {(() => {
            const top6 = stats.slice(0, 6);
            const userInTop6 = userCanonical ? top6.some(s => s.normalized_answer === userCanonical) : true;
            const userStatEntry = !userInTop6 && userCanonical ? stats.find(s => s.normalized_answer === userCanonical) : null;
            const displayStats = userStatEntry ? [...top6, userStatEntry] : top6;
            const maxPct = displayStats.length > 0 ? Math.max(...displayStats.map(s => s.percentage)) : 100;

            return displayStats.map((s, i) => {
              const isUser = userCanonical ? s.normalized_answer === userCanonical : false;
              const isAppended = userStatEntry && s === userStatEntry;
              const displayRank = isAppended ? s.rank : i + 1;
              const isFirst = displayRank === 1;
              const barWidth = Math.max((s.percentage / maxPct) * 100, 4);

              return (
                <motion.div
                  key={s.normalized_answer}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  className={`relative rounded-lg overflow-hidden ${
                    isUser
                      ? 'bg-primary/[0.06] ring-1 ring-primary/15'
                      : 'hover:bg-muted/30'
                  } ${isAppended ? 'mt-2 pt-2 border-t border-border/30' : ''}`}
                >
                  {/* Background bar */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.04, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 ${
                      isUser
                        ? config.barColor
                        : isFirst
                          ? 'bg-foreground/[0.04]'
                          : 'bg-foreground/[0.02]'
                    } rounded-lg`}
                  />

                  <div className="relative flex items-center justify-between gap-2 py-2 px-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-display text-[10px] tabular-nums shrink-0 w-4 text-right ${
                        isFirst ? 'text-foreground/60 font-bold' : 'text-muted-foreground/30'
                      }`}>
                        {displayRank}
                      </span>
                      <span className={`font-display text-[13px] break-words min-w-0 ${
                        isUser
                          ? 'text-foreground font-bold'
                          : isFirst
                            ? 'text-foreground/75 font-semibold'
                            : 'text-foreground/55 font-medium'
                      }`}>
                        {s.normalized_answer}
                        {isUser && (
                          <span className="text-[9px] text-primary font-bold ml-1.5 uppercase tracking-wider">You</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[12px] tabular-nums font-display ${
                        isUser ? 'text-foreground font-bold' : isFirst ? 'text-foreground/60 font-semibold' : 'text-muted-foreground/40'
                      }`}>
                        {s.percentage}%
                      </span>
                      <span className={`text-[9px] tabular-nums ${isUser ? 'text-muted-foreground/50' : 'text-muted-foreground/20'}`}>
                        ({s.count})
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground/40 text-center py-3">No answers yet</p>
        )}
      </motion.div>

      {/* Footer — stats + live */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/30"
      >
        <span>{total} players</span>
        <span>·</span>
        <span>{unique} unique</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--match-best))] animate-pulse" />
          Live
        </span>
      </motion.div>
    </div>
  );
}
