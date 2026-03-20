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
    'playjinx.lovable.app',
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
        'playjinx.lovable.app',
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

          {/* Hero */}
          <div className="text-center mb-6">
            {allAnswered ? (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mb-3"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
                    <Trophy className="h-7 w-7 text-primary" />
                  </div>
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight mb-1.5 text-foreground">
                  Today's JINX complete
                </h1>
                <p className="text-xs text-muted-foreground/50 flex items-center justify-center gap-1.5 mt-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                  Results update live
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground font-display tracking-[0.25em] uppercase mb-2">Today's Results</p>
                <h1 className="text-2xl font-bold tracking-tight mb-1 text-foreground">
                  {answeredCount} of {summaries.length} answered
                </h1>
              </>
            )}
          </div>

          {/* Share buttons — two-action system */}
          {allAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8 space-y-3"
            >
              {/* Primary: Challenge a friend */}
              <Button
                className="w-full rounded-xl h-13 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base shadow-md active:scale-[0.96] transition-transform"
                onClick={handleCopyChallenge}
              >
                {challengeCopied ? (
                  <>
                    <Check className="h-4.5 w-4.5 mr-2" />
                    Challenge copied!
                  </>
                ) : (
                  <>
                    <Zap className="h-4.5 w-4.5 mr-2" />
                    Challenge a friend
                  </>
                )}
              </Button>

              {/* Secondary: Share my results */}
              <Button
                variant="outline"
                className="w-full rounded-xl h-11 font-medium text-sm border-border active:scale-[0.97] transition-transform"
                onClick={handleCopyResults}
              >
                {resultsCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-2" />
                    Results copied!
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 mr-2" />
                    Share my results
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* Prompt cards */}
          <div className="space-y-2.5">
            {summaries.map((s, i) => (
              <motion.div
                key={s.prompt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06 }}
              >
                <Link
                  to={`/play?prompt=${i}`}
                  className="game-card block hover:border-primary/20 transition-all group py-4 px-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Prompt pair inline */}
                      <p className="font-display font-bold text-sm tracking-tight text-foreground mb-1.5">
                        {s.prompt.word_a} <span className="text-primary/60">+</span> {s.prompt.word_b}
                      </p>

                      {s.answer ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            → <span className="font-display font-bold text-foreground">{s.answer.raw_answer}</span>
                          </span>
                          <span className="text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full font-display font-bold">
                            #{s.rank}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40">
                            {s.matchCount} {s.matchCount === 1 ? 'match' : 'matches'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/40">Not answered</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Continue playing */}
          {!allAnswered && (
            <div className="mt-6">
              <Button className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base" asChild>
                <Link to="/play">
                  Continue playing <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}

          {/* Archive link */}
          <div className="mt-4">
            <Button variant="outline" className="w-full rounded-xl h-10 text-sm" asChild>
              <Link to="/archive">Browse archive</Link>
            </Button>
          </div>

          {/* Countdown */}
          <div className="text-center mt-8 space-y-1.5">
            <Countdown />
            <p className="text-[10px] text-muted-foreground/30">
              Ranks shift as more players answer
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
