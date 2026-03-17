import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Users, Hash, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStats, getUserAnswer, getPromptById, getTotalSubmissions, type AnswerStat, type DbPrompt, type DbAnswer } from '@/lib/store';

interface Props {
  promptId: string;
}

export default function ResultsView({ promptId }: Props) {
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [prompt, setPrompt] = useState<DbPrompt | null>(null);
  const [userAnswer, setUserAnswer] = useState<DbAnswer | null>(null);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
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
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return (
    <div className="game-card text-center py-10">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Loading results…</p>
    </div>
  );

  const unique = stats.length;
  const userStat = stats.find(s => s.normalized_answer === userAnswer?.normalized_answer);
  const topConcentration = stats.length > 0 ? stats[0].percentage : 0;
  const rank = userStat?.rank ?? 0;
  const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
  const topPercent = Math.max(1, 100 - percentile);
  const isEarly = total < 5;
  const matchCount = userStat?.count ?? 0;

  const shareText = prompt
    ? `JINX Daily\n${prompt.word_a} + ${prompt.word_b}\n\nMy answer: ${userAnswer?.raw_answer?.toUpperCase()}\nRank: #${rank} · Top ${topPercent}%\n\nCan you beat it?`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Early bird message */}
      {isEarly && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-card text-center py-4">
          <p className="text-xs text-muted-foreground">🌅 You're early! Results will grow as more players answer.</p>
        </motion.div>
      )}

      {/* Your answer highlight card */}
      {userStat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="game-card-elevated text-center py-6"
        >
          <Award className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">Your Answer</p>
          <p className="font-display text-3xl font-bold mb-3 jinx-gradient-text">{userAnswer?.raw_answer}</p>

          {/* Match message */}
          <p className="text-sm text-muted-foreground mb-4">
            You matched <span className="font-bold text-foreground">{matchCount}</span> {matchCount === 1 ? 'player' : 'players'}
          </p>

          <div className="flex justify-center gap-2 flex-wrap">
            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-display">
              Rank <span className="font-bold text-foreground">#{rank}</span>
            </span>
            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-display">
              <span className="font-bold text-foreground">{matchCount}</span> {matchCount === 1 ? 'match' : 'matches'}
            </span>
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-display font-bold">
              Top {topPercent}%
            </span>
          </div>
        </motion.div>
      )}

      {/* Prompt health stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, value: total, label: 'Players' },
          { icon: Hash, value: unique, label: 'Unique' },
          { icon: TrendingUp, value: `${topConcentration}%`, label: 'Top Answer' },
        ].map((stat) => (
          <div key={stat.label} className="game-card text-center py-3 px-2">
            <stat.icon className="h-3.5 w-3.5 mx-auto mb-1.5 text-muted-foreground/40" />
            <p className="text-lg font-display font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Answer clusters */}
      <div className="game-card">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em] mb-5 font-medium">Answer Clusters</p>
        <div className="space-y-3">
          {stats.slice(0, 8).map((s, i) => {
            const isUser = s.normalized_answer === userAnswer?.normalized_answer;
            return (
              <motion.div
                key={s.normalized_answer}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3"
              >
                <span className={`font-display text-[10px] w-5 text-right tabular-nums ${i === 0 ? 'text-primary font-bold' : 'text-muted-foreground/40'}`}>
                  #{i + 1}
                </span>
                <span className={`font-display text-xs w-20 text-right truncate ${isUser ? 'text-primary font-bold' : 'text-foreground/80'}`}>
                  {s.normalized_answer}
                </span>
                <div className="flex-1 cluster-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(s.percentage, 3)}%` }}
                    transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${
                      isUser
                        ? 'bg-primary/80'
                        : i === 0
                          ? 'bg-primary/30'
                          : 'bg-muted-foreground/15'
                    }`}
                  />
                </div>
                {/* Show percentage and count */}
                <span className={`font-display text-xs w-24 text-right tabular-nums whitespace-nowrap ${isUser ? 'text-primary font-bold' : 'text-muted-foreground/60'}`}>
                  {s.percentage}%
                  <span className="text-[10px] text-muted-foreground/40 ml-1">({s.count})</span>
                </span>
              </motion.div>
            );
          })}
        </div>
        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No answers yet — be the first!</p>
        )}
      </div>

      {/* Share */}
      <Button
        variant="outline"
        className="w-full rounded-xl h-11 border-border/60 hover:bg-secondary/80 transition-all"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
        {copied ? 'Copied!' : 'Share result'}
      </Button>
    </div>
  );
}
