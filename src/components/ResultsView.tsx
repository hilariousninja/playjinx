import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStats, getUserAnswer, getPromptById, getTotalSubmissions } from '@/lib/store';
import type { PromptAnswerStat } from '@/lib/types';

interface Props {
  promptId: string;
}

export default function ResultsView({ promptId }: Props) {
  const [stats, setStats] = useState<PromptAnswerStat[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setStats(getStats(promptId));
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [promptId]);

  const prompt = getPromptById(promptId);
  const userAnswer = getUserAnswer(promptId);
  const total = getTotalSubmissions(promptId);
  const unique = stats.length;
  const userStat = stats.find(s => s.normalized_answer === userAnswer?.normalized_answer);
  const topConcentration = stats.length > 0 ? stats[0].percentage : 0;

  const rank = userStat?.rank ?? 0;
  const percentile = total > 0 && userStat ? Math.round(((total - (userStat.count > 0 ? rank : total)) / total) * 100) : 0;

  const shareText = prompt
    ? `JINX Daily — ${prompt.word_a} + ${prompt.word_b}\nMy answer: ${userAnswer?.raw_answer?.toUpperCase()}\nRank: #${rank} · Top ${100 - percentile}%\nCan you beat it?`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="game-card text-center py-3">
          <p className="text-2xl font-display font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Submissions</p>
        </div>
        <div className="game-card text-center py-3">
          <p className="text-2xl font-display font-bold">{unique}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Unique</p>
        </div>
        <div className="game-card text-center py-3">
          <p className="text-2xl font-display font-bold">{topConcentration}%</p>
          <p className="text-[10px] text-muted-foreground uppercase">Top Answer</p>
        </div>
      </div>

      {/* User result */}
      {userStat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="game-card text-center"
        >
          <p className="text-xs text-muted-foreground mb-1">Your answer</p>
          <p className="font-display text-xl font-bold mb-2">{userAnswer?.raw_answer}</p>
          <div className="flex justify-center gap-4 text-sm">
            <span>Rank <span className="font-display font-bold">#{rank}</span></span>
            <span className="text-muted-foreground">·</span>
            <span><span className="font-display font-bold">{userStat.count}</span> matches</span>
            <span className="text-muted-foreground">·</span>
            <span>Top <span className="font-display font-bold">{Math.max(1, 100 - percentile)}%</span></span>
          </div>
        </motion.div>
      )}

      {/* Clusters */}
      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Answer Clusters</p>
        <div className="space-y-2">
          {stats.slice(0, 8).map((s, i) => (
            <motion.div
              key={s.normalized_answer}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="font-display text-xs w-16 text-right text-muted-foreground truncate">{s.normalized_answer}</span>
              <div className="flex-1 cluster-bar">
                <div
                  className={`cluster-bar-fill ${s.normalized_answer === userAnswer?.normalized_answer ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                  style={{ width: `${s.percentage}%` }}
                />
              </div>
              <span className="font-display text-xs w-10">{s.percentage}%</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Share */}
      <Button variant="outline" className="w-full rounded-2xl" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        {copied ? 'Copied!' : 'Share result'}
      </Button>
    </div>
  );
}
