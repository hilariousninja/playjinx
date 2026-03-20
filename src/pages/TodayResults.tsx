import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Users, ChevronRight, Copy, Check, Trophy, Zap, Share2 } from 'lucide-react';
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
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);

  const refresh = async () => {
    const prompts = await ensureDailyPrompts();
    const results = await Promise.all(
      prompts.map(async (prompt) => {
        const [answer, total, stats] = await Promise.all([
          getUserAnswer(prompt.id),
          getTotalSubmissions(prompt.id),
          getStats(prompt.id),
        ]);
        let userStat: AnswerStat | null = null;
        if (answer) {
          const canon = await getCanonicalAnswer(answer.normalized_answer);
          userStat = stats.find(s => s.normalized_answer === canon) ?? null;
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

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  // --- Challenge share (spoiler-free) ---
  const challengeText = [
    '⚡ JINX Daily',
    '',
    'Can you match me?',
    '',
    ...summaries.map(s => `${s.prompt.word_a.toUpperCase()} + ${s.prompt.word_b.toUpperCase()}`),
    '',
    'playjinx.com',
  ].join('\n');

  // --- Results share (with answers) ---
  const getAnswerEmoji = (topPercent: number) => {
    if (topPercent <= 15) return '🟩';
    if (topPercent <= 50) return '🟨';
    return '🟥';
  };

  const bestHit = allAnswered
    ? summaries.reduce((best, s) => s.matchCount > best.matchCount ? s : best, summaries[0])
    : null;

  const resultsText = allAnswered
    ? [
        `⚡ JINX Daily — ${today}`,
        '',
        ...summaries.map(s => `${getAnswerEmoji(s.topPercent)} ${s.answer?.raw_answer?.toUpperCase()}`),
        '',
        ...(bestHit?.answer ? [`Best hit: ${bestHit.answer.raw_answer.toUpperCase()}`] : []),
        '',
        'Can you match me?',
        'playjinx.com',
      ].join('\n')
    : '';

  const handleCopyChallenge = () => {
    navigator.clipboard.writeText(challengeText);
    setChallengeCopied(true);
    setTimeout(() => setChallengeCopied(false), 2500);
  };

  const handleCopyResults = () => {
    navigator.clipboard.writeText(resultsText);
    setResultsCopied(true);
    setTimeout(() => setResultsCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8" asChild>
              <Link to="/play">Play</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-[22rem] mx-auto px-5 pt-8 w-full">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

            {/* Hero */}
            <div className="text-center mb-6">
              {allAnswered ? (
                <>
                  <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-display mb-3">{today}</p>
                  <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
                    Today's JINX complete
                  </h1>
                  <p className="text-[10px] text-muted-foreground/30 flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="inline-block w-1 h-1 rounded-full bg-primary/30 animate-pulse" />
                    Results update live
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-display mb-3">{today}</p>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    {answeredCount} of {summaries.length} answered
                  </h1>
                </>
              )}
            </div>

            {/* Share buttons — lighter weight */}
            {allAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6 space-y-2"
              >
                <Button
                  className="w-full rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm active:scale-[0.97] transition-transform"
                  onClick={handleCopyChallenge}
                >
                  {challengeCopied ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5" /> Challenge copied!</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 mr-1.5" /> Challenge a friend</>
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full rounded-xl h-10 font-medium text-xs border-border/60 active:scale-[0.97] transition-transform"
                  onClick={handleCopyResults}
                >
                  {resultsCopied ? (
                    <><Check className="h-3 w-3 mr-1.5" /> Results copied!</>
                  ) : (
                    <><Share2 className="h-3 w-3 mr-1.5" /> Share my results</>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Prompt cards */}
            <div className="space-y-2">
              {summaries.map((s, i) => (
                <motion.div
                  key={s.prompt.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                >
                  <Link
                    to={`/play?prompt=${i}`}
                    className="block bg-card border border-border/50 rounded-xl px-5 py-3.5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-[14px] tracking-tight text-foreground mb-1">
                          {s.prompt.word_a} <span className="text-primary/50">+</span> {s.prompt.word_b}
                        </p>
                        {s.answer ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-muted-foreground/50">
                              → <span className="font-display font-bold text-foreground/70">{s.answer.raw_answer}</span>
                            </span>
                            <span className="text-[9px] text-muted-foreground/30">
                              #{s.rank} · {s.matchCount} {s.matchCount === 1 ? 'match' : 'matches'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/30">Not answered</p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Continue playing */}
            {!allAnswered && (
              <div className="mt-5">
                <Button className="w-full rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm" asChild>
                  <Link to="/play">
                    Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Archive link */}
            <div className="mt-3">
              <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-border/50" asChild>
                <Link to="/archive">Browse archive</Link>
              </Button>
            </div>

            {/* Countdown */}
            <div className="text-center mt-6">
              <Countdown />
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
