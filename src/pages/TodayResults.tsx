import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Users, RefreshCw, Award, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, getUserAnswer, getTotalSubmissions, getStats, type DbPrompt, type DbAnswer, type AnswerStat } from '@/lib/store';
import Countdown from '@/components/Countdown';

interface PromptSummary {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  total: number;
  rank: number;
  matchCount: number;
  topPercent: number;
}

export default function TodayResults() {
  const [summaries, setSummaries] = useState<PromptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const prompts = await getActivePrompts();
    const results = await Promise.all(
      prompts.map(async (prompt) => {
        const [answer, total, stats] = await Promise.all([
          getUserAnswer(prompt.id),
          getTotalSubmissions(prompt.id),
          getStats(prompt.id),
        ]);
        const userStat = answer ? stats.find(s => s.normalized_answer === answer.normalized_answer) : null;
        const rank = userStat?.rank ?? 0;
        const matchCount = userStat?.count ?? 0;
        const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
        const topPercent = Math.max(1, 100 - percentile);
        return { prompt, answer, total, rank, matchCount, topPercent };
      })
    );
    setSummaries(results);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const allAnswered = summaries.length > 0 && summaries.every(s => s.answer);
  const answeredCount = summaries.filter(s => s.answer).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-card/30 backdrop-blur-sm shrink-0">
        <div className="container flex items-center justify-between h-14 max-w-lg mx-auto">
          <Link to="/" className="font-display text-lg font-bold tracking-tight jinx-gradient-text">JINX</Link>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link to="/play">Play</Link>
          </Button>
        </div>
      </nav>

      <div className="flex-1 container max-w-lg mx-auto px-5 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-[11px] text-muted-foreground/60 font-display tracking-[0.3em] uppercase mb-2">Today's Results</p>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {allAnswered ? 'All prompts completed' : `${answeredCount} of ${summaries.length} answered`}
            </h1>
            <p className="text-xs text-muted-foreground/50 flex items-center justify-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Results update live as more players answer
            </p>
          </div>

          {/* Prompt cards */}
          <div className="space-y-3">
            {summaries.map((s, i) => (
              <motion.div
                key={s.prompt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/play?prompt=${i}`}
                  className="game-card block hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Prompt words */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Prompt {i + 1}</p>
                      <p className="font-display font-bold text-base tracking-tight">
                        {s.prompt.word_a} <span className="text-primary">+</span> {s.prompt.word_b}
                      </p>

                      {s.answer ? (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            Your answer: <span className="font-display font-bold text-foreground">{s.answer.raw_answer}</span>
                          </span>
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-display">
                            #{s.rank}
                          </span>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold">
                            Top {s.topPercent}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 mt-2">Not answered yet</p>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                        <Users className="h-3 w-3" />
                        <span>{s.total}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            {!allAnswered && (
              <Button className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" asChild>
                <Link to="/play">
                  Continue playing <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
            <Button variant="outline" className="w-full rounded-xl h-11 border-border/60" asChild>
              <Link to="/archive">Browse archive</Link>
            </Button>
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-border/50 py-4 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — a party word game in development</p>
      </footer>
    </div>
  );
}
