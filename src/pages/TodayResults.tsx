import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Users, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, getUserAnswer, getTotalSubmissions, getStats, type DbPrompt, type DbAnswer, type AnswerStat } from '@/lib/store';
import Countdown from '@/components/Countdown';
import JinxLogo from '@/components/JinxLogo';

interface PromptSummary {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  total: number;
  rank: number;
  matchCount: number;
  topPercent: number;
  topAnswer: AnswerStat | null;
}

export default function TodayResults() {
  const [summaries, setSummaries] = useState<PromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const prompts = await ensureDailyPrompts();
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
        const topAnswer = stats.length > 0 ? stats[0] : null;
        return { prompt, answer, total, rank, matchCount, topPercent, topAnswer };
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
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const allAnswered = summaries.length > 0 && summaries.every(s => s.answer);
  const answeredCount = summaries.filter(s => s.answer).length;

  // Build share text with performance headline
  const bestTopPercent = allAnswered
    ? Math.min(...summaries.map(s => s.topPercent))
    : null;

  const getHeadline = () => {
    if (!bestTopPercent) return 'JINX Daily';
    if (bestTopPercent <= 5) return 'JINX Daily 🔥 Mind reader!';
    if (bestTopPercent <= 20) return 'JINX Daily ⚡ Strong match!';
    if (bestTopPercent <= 50) return 'JINX Daily 👀 Decent run';
    return 'JINX Daily 🎲 Wildcard answers';
  };

  const shareText = allAnswered
    ? [
        getHeadline(),
        '',
        ...summaries.map(s =>
          `${s.prompt.word_a} + ${s.prompt.word_b} → #${s.rank} ${s.answer?.raw_answer?.toUpperCase()}`
        ),
        '',
        `Best: Top ${bestTopPercent}%`,
        'playjinx.lovable.app',
      ].join('\n')
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={20} className="text-foreground text-lg" />
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/play">Play</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto px-5 py-8 w-full">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <p className="text-[11px] text-muted-foreground font-display tracking-[0.25em] uppercase mb-2">Today's Results</p>
            <h1 className="text-xl font-bold tracking-tight mb-2 text-foreground">
              {allAnswered ? 'All prompts completed' : `${answeredCount} of ${summaries.length} answered`}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
              Results update live as more players answer
            </p>
            <Countdown />
          </div>

          <div className="space-y-3">
            {summaries.map((s, i) => (
              <motion.div
                key={s.prompt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={`/play?prompt=${i}`}
                  className="game-card block hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Prompt {i + 1}</p>
                      <p className="font-display font-bold text-base tracking-tight text-foreground">
                        {s.prompt.word_a} <span className="text-primary">+</span> {s.prompt.word_b}
                      </p>

                      {s.answer ? (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            You chose: <span className="font-display font-bold text-foreground">{s.answer.raw_answer}</span>
                          </span>
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-display">
                            #{s.rank}
                          </span>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold">
                            Top {s.topPercent}%
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-2">Not answered yet</p>
                      )}

                      {/* #1 answer for this prompt */}
                      {s.topAnswer && (
                        <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                          #1: <span className="font-display font-medium text-muted-foreground">{s.topAnswer.normalized_answer}</span> — {s.topAnswer.percentage}% ({s.topAnswer.count})
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
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

          <div className="mt-8 space-y-3">
            {/* Copy all results */}
            {allAnswered && (
              <Button
                className="w-full rounded-lg h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy results'}
              </Button>
            )}
            {!allAnswered && (
              <Button className="w-full rounded-lg h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" asChild>
                <Link to="/play">
                  Continue playing <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
            <Button variant="outline" className="w-full rounded-lg h-11" asChild>
              <Link to="/archive">Browse archive</Link>
            </Button>
          </div>

          {/* Return hook */}
          <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
            More players are still answering — check back later to see how results change
          </p>
        </motion.div>
      </div>

      <footer className="border-t border-border py-4 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/50 tracking-wide">JINX — a party word game in development</p>
      </footer>
    </div>
  );
}
