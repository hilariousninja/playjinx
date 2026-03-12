import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Users, Hash, TrendingUp } from 'lucide-react';
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
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return (
    <div className="game-card text-center py-8">
      <p className="text-sm text-muted-foreground animate-pulse-soft">Loading results…</p>
    </div>
  );

  const unique = stats.length;
  const userStat = stats.find(s => s.normalized_answer === userAnswer?.normalized_answer);
  const topConcentration = stats.length > 0 ? stats[0].percentage : 0;
  const rank = userStat?.rank ?? 0;
  const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
  const isEarly = total < 5;

  const shareText = prompt
    ? `JINX Daily — ${prompt.word_a} + ${prompt.word_b}\nMy answer: ${userAnswer?.raw_answer?.toUpperCase()}\nRank: #${rank} · Top ${Math.max(1, 100 - percentile)}%\nCan you beat it?`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Early bird message */}
      {isEarly && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-card text-center py-4">
          <p className="text-xs text-muted-foreground">🌅 You're early! More answers will appear as players play.</p>
        </motion.div>
      )}

      {/* Prompt health stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card text-center py-3 px-2">
          <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground/60" />
          <p className="text-xl font-display font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Submissions</p>
        </div>
        <div className="game-card text-center py-3 px-2">
          <Hash className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground/60" />
          <p className="text-xl font-display font-bold">{unique}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unique</p>
        </div>
        <div className="game-card text-center py-3 px-2">
          <TrendingUp className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground/60" />
          <p className="text-xl font-display font-bold">{topConcentration}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Answer</p>
        </div>
      </div>

      {/* Your answer card */}
      {userStat && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="game-card text-center py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Your answer</p>
          <p className="font-display text-2xl font-bold mb-3">{userAnswer?.raw_answer}</p>
          <div className="flex justify-center gap-3 text-xs">
            <span className="bg-secondary px-2.5 py-1 rounded-full">
              Rank <span className="font-display font-bold">#{rank}</span>
            </span>
            <span className="bg-secondary px-2.5 py-1 rounded-full">
              <span className="font-display font-bold">{userStat.count}</span> matches
            </span>
            <span className="bg-secondary px-2.5 py-1 rounded-full">
              Top <span className="font-display font-bold">{Math.max(1, 100 - percentile)}%</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Answer clusters */}
      <div className="game-card">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-4">Answer Clusters</p>
        <div className="space-y-2.5">
          {stats.slice(0, 8).map((s, i) => {
            const isUser = s.normalized_answer === userAnswer?.normalized_answer;
            return (
              <motion.div
                key={s.normalized_answer}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3"
              >
                <span className="font-display text-[10px] text-muted-foreground/50 w-4 text-right">#{i + 1}</span>
                <span className={`font-display text-xs w-20 text-right truncate ${isUser ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                  {s.normalized_answer}
                </span>
                <div className="flex-1 h-7 rounded-lg bg-secondary relative overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(s.percentage, 2)}%` }}
                    transition={{ duration: 0.7, delay: i * 0.06 }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${isUser ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  />
                </div>
                <span className="font-display text-xs w-10 text-right tabular-nums">{s.percentage}%</span>
              </motion.div>
            );
          })}
        </div>
        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No answers yet — be the first!</p>
        )}
      </div>

      {/* Share */}
      <Button variant="outline" className="w-full rounded-2xl h-11" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        {copied ? 'Copied!' : 'Share result'}
      </Button>
    </div>
  );
}
