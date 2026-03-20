import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { getStats, getUserAnswer, getPromptById, getTotalSubmissions, getCanonicalAnswer, type AnswerStat, type DbPrompt, type DbAnswer } from '@/lib/store';

interface Props {
  promptId: string;
}

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
    <div className="text-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
      <p className="text-[11px] text-muted-foreground/50">Loading results…</p>
    </div>
  );

  const unique = stats.length;
  const userStat = userCanonical ? stats.find(s => s.normalized_answer === userCanonical) : undefined;
  const topAnswer = stats.length > 0 ? stats[0] : null;
  const rank = userStat?.rank ?? 0;
  const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
  const topPercent = Math.max(1, 100 - percentile);
  const matchCount = userStat?.count ?? 0;
  const topAnswerPct = topAnswer?.percentage ?? 0;

  // Result quality label
  const getResultLabel = () => {
    if (topPercent <= 5) return 'Perfect match';
    if (topPercent <= 15) return 'Strong match';
    if (topPercent <= 35) return 'Good match';
    if (topPercent <= 60) return 'Decent match';
    return 'Unique answer';
  };

  const getResultColor = () => {
    if (topPercent <= 15) return 'text-primary';
    if (topPercent <= 35) return 'text-primary/80';
    if (topPercent <= 60) return 'text-muted-foreground';
    return 'text-muted-foreground/60';
  };

  return (
    <div className="space-y-6">
      {/* Main reveal — your answer + result */}
      {userStat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          {/* Result quality label */}
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`text-xs font-display font-bold uppercase tracking-[0.2em] mb-3 ${getResultColor()}`}
          >
            {getResultLabel()}
          </motion.p>

          {/* The answer — hero */}
          <motion.p
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="font-display text-3xl font-bold text-foreground break-words mb-4"
          >
            {userAnswer?.raw_answer}
          </motion.p>

          {/* Stats chips — inline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60"
          >
            <span className="font-display">
              Rank <span className="font-bold text-foreground">#{rank}</span>
            </span>
            <span className="text-border">·</span>
            <span className="font-display">
              Top <span className="font-bold text-primary">{topPercent}%</span>
            </span>
            <span className="text-border">·</span>
            <span className="font-display">
              <span className="font-bold text-foreground">{matchCount}</span> {matchCount === 1 ? 'match' : 'matches'}
            </span>
          </motion.div>
        </motion.div>
      )}

      {/* #1 Answer comparison */}
      {topAnswer && userStat && topAnswer.normalized_answer !== userCanonical && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em]">
            <Crown className="h-3 w-3" />
            <span>#1 answer</span>
          </div>
          <p className="font-display text-lg font-bold text-foreground/70 mt-0.5 break-words">{topAnswer.normalized_answer}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            {topAnswer.percentage}% · {topAnswer.count} {topAnswer.count === 1 ? 'player' : 'players'}
          </p>
        </motion.div>
      )}

      {/* If user IS the top answer */}
      {topAnswer && userStat && topAnswer.normalized_answer === userCanonical && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-[11px] text-primary/60 font-display font-medium">
            You picked the #1 answer
          </p>
        </motion.div>
      )}

      {/* Answer distribution */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] mb-3 font-medium">Distribution</p>
        <div className="space-y-0.5">
          {stats.slice(0, 6).map((s, i) => {
            const isUser = userCanonical ? s.normalized_answer === userCanonical : false;
            return (
              <motion.div
                key={s.normalized_answer}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.04 }}
                className={`py-2 px-2.5 rounded-lg ${isUser ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className={`font-display text-[10px] tabular-nums shrink-0 w-3.5 text-right ${i === 0 ? 'text-primary font-bold' : 'text-muted-foreground/30'}`}>
                      {i + 1}
                    </span>
                    <span className={`font-display text-sm break-words min-w-0 ${isUser ? 'text-primary font-bold' : 'text-foreground/80 font-medium'}`}>
                      {s.normalized_answer}
                    </span>
                  </div>
                  <span className={`text-[10px] tabular-nums whitespace-nowrap shrink-0 ${isUser ? 'text-primary font-bold' : 'text-muted-foreground/40'}`}>
                    {s.percentage}%
                    <span className="text-muted-foreground/20 ml-0.5">({s.count})</span>
                  </span>
                </div>
                <div className="relative h-[3px] rounded-full bg-border/40 ml-5.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(s.percentage, 3)}%` }}
                    transition={{ duration: 0.6, delay: 0.45 + i * 0.04, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      isUser ? 'bg-primary/50' : i === 0 ? 'bg-primary/20' : 'bg-muted-foreground/15'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground/40 text-center py-4">No answers yet — be the first!</p>
        )}
      </motion.div>

      {/* Summary stats — single light row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground/35 pt-1"
      >
        <span>{total} players</span>
        <span className="text-border/60">·</span>
        <span>{unique} unique</span>
        <span className="text-border/60">·</span>
        <span>{topAnswerPct}% consensus</span>
      </motion.div>

      {/* Live indicator */}
      <div className="text-center pt-1">
        <p className="text-[9px] text-muted-foreground/25 flex items-center justify-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-primary/30 animate-pulse" />
          Live
        </p>
      </div>
    </div>
  );
}
