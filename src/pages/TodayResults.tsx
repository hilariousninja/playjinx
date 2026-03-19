import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Users, ChevronRight, Copy, Check, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, getUserAnswer, getTotalSubmissions, getStats, getCanonicalAnswer, type DbPrompt, type DbAnswer, type AnswerStat } from '@/lib/store';
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
        // Resolve user's answer through the same alias+fuzzy pipeline
        let userStat: AnswerStat | null = null;
        if (answer) {
          const canon = await getCanonicalAnswer(answer.normalized_answer);
          userStat = stats.find(s => s.normalized_answer === canon) ?? null;
          // Fallback: fuzzy match against stat keys (in case fuzzy merged further)
          if (!userStat) {
            const { levenshtein } = await import('@/lib/normalize');
            userStat = stats.find(s => {
              const dist = levenshtein(canon, s.normalized_answer);
              return s.normalized_answer.length > 6 && dist <= (s.normalized_answer.length >= 10 ? 2 : 1);
            }) ?? null;
          }
        }
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

  const bestTopPercent = allAnswered
    ? Math.min(...summaries.map(s => s.topPercent))
    : null;

  const getHeadline = () => {
    if (!bestTopPercent) return 'JINX Daily';
    if (bestTopPercent <= 5) return '🔥 Mind reader!';
    if (bestTopPercent <= 20) return '⚡ Strong match!';
    if (bestTopPercent <= 50) return '👀 Decent run';
    return '🎲 Tough round';
  };

  const getMedal = (tp: number) => {
    if (tp <= 10) return '🥇';
    if (tp <= 30) return '🥈';
    if (tp <= 60) return '🥉';
    return '';
  };

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const shareText = allAnswered
    ? [
        `JINX Daily — ${today}`,
        getHeadline(),
        '',
        ...summaries.map((s, i) => {
          const medal = getMedal(s.topPercent);
          return `${i + 1}. ${s.prompt.word_a} + ${s.prompt.word_b} → ${s.answer?.raw_answer?.toUpperCase()}${medal ? ` ${medal}` : ''} (Top ${s.topPercent}%)`;
        }),
        '',
        `Best: ${getMedal(bestTopPercent!)} Top ${bestTopPercent}%`,
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
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
              <Link to="/play">Play</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto px-5 py-8 w-full">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

          {/* Hero completion section */}
          <div className="text-center mb-8">
            {allAnswered ? (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mb-4"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                    <Trophy className="h-7 w-7 text-primary" />
                  </div>
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
                  All prompts completed!
                </h1>

                {/* Best-of-3 badge */}
                {bestTopPercent !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full mb-3"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-sm font-display font-bold">{getHeadline()}</span>
                    <span className="text-xs font-display opacity-80">Best: Top {bestTopPercent}%</span>
                  </motion.div>
                )}
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground font-display tracking-[0.25em] uppercase mb-2">Today's Results</p>
                <h1 className="text-xl font-bold tracking-tight mb-2 text-foreground">
                  {answeredCount} of {summaries.length} answered
                </h1>
              </>
            )}

            <p className="text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1.5 mt-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
              Results update as more players answer
            </p>
          </div>

          {/* Share button — prominent for completed */}
          {allAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <Button
                className="w-full rounded-xl h-13 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base shadow-sm"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Share your results'}
              </Button>
              <p className="text-[10px] text-muted-foreground/40 text-center mt-2">Copies a summary you can paste anywhere</p>
            </motion.div>
          )}

          {/* Prompt cards */}
          <div className="space-y-3">
            {summaries.map((s, i) => (
              <motion.div
                key={s.prompt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06 }}
              >
                <Link
                  to={`/play?prompt=${i}`}
                  className="game-card block hover:border-primary/30 transition-all group"
                >
                  {/* Row 1: Prompt number + word pair */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1 font-display">Prompt {i + 1}</p>
                      <p className="font-display font-bold text-base tracking-tight text-foreground">
                        {s.prompt.word_a} <span className="text-primary">+</span> {s.prompt.word_b}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-primary transition-colors mt-4 shrink-0" />
                  </div>

                  {s.answer ? (
                    <>
                      {/* Row 2: Your answer + performance chips */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs text-muted-foreground">
                          You chose <span className="font-display font-bold text-foreground break-words">{s.answer.raw_answer}</span>
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-display font-bold">
                          Top {s.topPercent}%
                        </span>
                        <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-display">
                          #{s.rank}
                        </span>
                      </div>

                      {/* Row 3: #1 answer + player count */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                        {s.topAnswer && (
                          <span>
                            #1: <span className="font-display font-medium text-muted-foreground break-words">{s.topAnswer.normalized_answer}</span> ({s.topAnswer.percentage}%)
                          </span>
                        )}
                        <span className="flex items-center gap-1 shrink-0 ml-2">
                          <Users className="h-2.5 w-2.5" />
                          {s.total}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 mt-1">Not answered yet</p>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
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

          {/* Footer messaging */}
          <div className="text-center mt-8 space-y-1.5">
            <Countdown />
            <p className="text-[10px] text-muted-foreground/40">
              Check back later to see how your answers perform
            </p>
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
