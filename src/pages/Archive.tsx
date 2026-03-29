import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Send, Check, Loader2, ChevronRight, Zap, Share2, ArrowRight, Trophy, Target, TrendingUp, Sparkles, Minus } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getArchivePrompts, ensureDailyPrompts, hasSubmitted, getTotalSubmissions,
  submitAnswer, getUserAnswer, getDailyUniquePlayers, getStats, getCanonicalAnswer,
  type DbPrompt, type DbAnswer, type AnswerStat,
} from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import ResultsView from '@/components/ResultsView';
import Countdown from '@/components/Countdown';
import JinxLogo from '@/components/JinxLogo';

interface PromptSummary {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  total: number;
  rank: number;
  matchCount: number;
  topPercent: number;
}

export default function Archive() {
  const [archivePrompts, setArchivePrompts] = useState<DbPrompt[]>([]);
  const [todayPrompts, setTodayPrompts] = useState<DbPrompt[]>([]);
  const [todaySummaries, setTodaySummaries] = useState<PromptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({});
  const [dailyPlayers, setDailyPlayers] = useState<Record<string, number>>({});
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const todayLabel = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const loadData = async () => {
    const [archive, today] = await Promise.all([
      getArchivePrompts(),
      ensureDailyPrompts(),
    ]);

    setTodayPrompts(today);

    // Filter archive to exclude today
    const pastOnly = archive.filter(p => p.date !== todayStr);
    setArchivePrompts(pastOnly);

    // Load submission state for all prompts
    const allPrompts = [...today, ...pastOnly];
    const subMap: Record<string, boolean> = {};
    const ansMap: Record<string, DbAnswer> = {};
    const totals: Record<string, number> = {};

    await Promise.all(allPrompts.map(async (p) => {
      subMap[p.id] = await hasSubmitted(p.id);
      const ua = await getUserAnswer(p.id);
      if (ua) ansMap[p.id] = ua;
      totals[p.id] = await getTotalSubmissions(p.id);
    }));

    setSubmittedMap(subMap);
    setUserAnswers(ansMap);
    setTotalCounts(totals);

    // Today summaries for the hub
    const summaries = await Promise.all(
      today.map(async (prompt) => {
        const answer = ansMap[prompt.id] ?? null;
        const total = totals[prompt.id] ?? 0;
        let rank = 0, matchCount = 0, topPercent = 100;
        if (answer) {
          const stats = await getStats(prompt.id);
          const canon = await getCanonicalAnswer(answer.normalized_answer);
          let userStat = stats.find(s => s.normalized_answer === canon) ?? null;
          if (!userStat) {
            const { levenshtein } = await import('@/lib/normalize');
            userStat = stats.find(s => {
              const dist = levenshtein(canon, s.normalized_answer);
              return s.normalized_answer.length > 6 && dist <= (s.normalized_answer.length >= 10 ? 2 : 1);
            }) ?? null;
          }
          rank = userStat?.rank ?? 0;
          matchCount = userStat?.count ?? 0;
          const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
          topPercent = Math.max(1, 100 - percentile);
        }
        return { prompt, answer, total, rank, matchCount, topPercent };
      })
    );
    setTodaySummaries(summaries);

    // Unique players per archive day
    const byDate: Record<string, string[]> = {};
    for (const p of pastOnly) {
      (byDate[p.date] = byDate[p.date] || []).push(p.id);
    }
    const dpMap: Record<string, number> = {};
    await Promise.all(Object.entries(byDate).map(async ([date, ids]) => {
      dpMap[date] = await getDailyUniquePlayers(ids);
    }));
    setDailyPlayers(dpMap);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    const trimmed = inputVal.trim();
    const validationError = validateInput(trimmed);
    if (validationError) { setInputError(validationError); return; }
    if (submittedMap[selected]) return;

    setSubmitting(true);
    setInputError(null);
    try {
      const answer = await submitAnswer(selected, trimmed);
      setSubmittedMap(prev => ({ ...prev, [selected]: true }));
      setUserAnswers(prev => ({ ...prev, [selected]: answer }));
      setTotalCounts(prev => ({ ...prev, [selected]: (prev[selected] || 0) + 1 }));
      setInputVal('');
    } catch (err: any) {
      setInputError(err?.message || 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );

  const grouped = archivePrompts.reduce<Record<string, DbPrompt[]>>((acc, p) => {
    (acc[p.date] = acc[p.date] || []).push(p); return acc;
  }, {});

  const allTodayAnswered = todaySummaries.length > 0 && todaySummaries.every(s => s.answer);
  const todayAnsweredCount = todaySummaries.filter(s => s.answer).length;

  // Sharing
  const getAnswerEmoji = (topPercent: number) => {
    if (topPercent <= 15) return '🟩';
    if (topPercent <= 50) return '🟨';
    return '🟥';
  };

  const challengeText = [
    '⚡ JINX Daily', '', 'Can you match me?', '',
    ...todaySummaries.map(s => `${s.prompt.word_a.toUpperCase()} + ${s.prompt.word_b.toUpperCase()}`),
    '', 'playjinx.com',
  ].join('\n');

  const bestHit = allTodayAnswered
    ? todaySummaries.reduce((best, s) => s.matchCount > best.matchCount ? s : best, todaySummaries[0])
    : null;

  const resultsText = allTodayAnswered
    ? [
        `⚡ JINX Daily — ${todayLabel}`, '',
        ...todaySummaries.map(s => `${getAnswerEmoji(s.topPercent)} ${s.answer?.raw_answer?.toUpperCase()}`),
        '', ...(bestHit?.answer ? [`Best hit: ${bestHit.answer.raw_answer.toUpperCase()}`] : []),
        '', 'Can you match me?', 'playjinx.com',
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

  // ─── DETAIL SCREEN ───
  const selectedPrompt = [...todayPrompts, ...archivePrompts].find(p => p.id === selected);
  if (selectedPrompt) {
    const isSubmitted = submittedMap[selectedPrompt.id];
    const isToday = selectedPrompt.date === todayStr;
    const dateLabel = new Date(selectedPrompt.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/80 shrink-0">
          <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
            <button onClick={() => { setSelected(null); setInputVal(''); setInputError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to="/">
              <JinxLogo size={18} className="text-foreground text-base" />
            </Link>
            <span className="w-4" />
          </div>
        </header>

        <div className={`flex-1 flex flex-col items-center ${isSubmitted ? 'pt-[5vh] md:pt-[6vh]' : 'pt-[10vh] md:pt-[12vh]'} transition-all duration-300`}>
          <div className="w-full max-w-[22rem] mx-auto px-5">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-display mb-4">
                {isToday ? 'Today' : dateLabel}
              </p>
              <div className="mb-4">
                <PromptPair wordA={selectedPrompt.word_a} wordB={selectedPrompt.word_b} size="lg" />
              </div>

              {!isSubmitted ? (
                <>
                  <p className="text-[13px] font-bold text-primary/80 mb-6">
                    What would most people say?
                  </p>
                  <div className="relative">
                    <Input
                      value={inputVal}
                      onChange={e => { setInputVal(e.target.value); setInputError(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      placeholder="Type your word…"
                      className={`rounded-xl text-center font-display bg-card h-14 text-lg border-2 focus:border-primary focus:ring-0 placeholder:text-muted-foreground/25 pr-14 shadow-sm ${inputError ? 'border-destructive' : 'border-border/60'}`}
                      maxLength={80}
                      disabled={submitting}
                      autoFocus
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputVal.trim() || submitting}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg h-10 w-10 bg-primary hover:bg-primary/90 shadow-sm active:scale-[0.93] transition-transform"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {inputError && <p className="text-[11px] text-destructive mt-2">{inputError}</p>}
                  {(totalCounts[selectedPrompt.id] ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground/40 flex items-center justify-center gap-1.5 mt-5">
                      <Users className="h-3 w-3" />
                      {totalCounts[selectedPrompt.id]} players answered
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {isSubmitted && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-2">
                <ResultsView promptId={selectedPrompt.id} />
                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setSelected(null); setInputVal(''); setInputError(null); }}
                    className="text-[10px] uppercase tracking-wide text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <footer className="border-t border-border py-3 shrink-0">
          <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
        </footer>
      </div>
    );
  }

  // ─── MAIN LIST ───
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 text-xs h-8" asChild>
            <Link to="/play">Play</Link>
          </Button>
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-[22rem] mx-auto px-5 pt-8 w-full">

          {/* ─── TODAY SECTION ─── */}
          {todayPrompts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-display">{todayLabel}</p>
                  <span className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold flex items-center gap-1">
                    <Zap className="h-2 w-2" /> Live
                  </span>
                </div>
                {allTodayAnswered ? (
                  <>
                    <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">Today's JINX complete</h1>
                    <p className="text-[10px] text-muted-foreground/30 flex items-center justify-center gap-1.5 mt-1.5">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary/30 animate-pulse" />
                      Results update live
                    </p>
                  </>
                ) : todayAnsweredCount > 0 ? (
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    {todayAnsweredCount} of {todaySummaries.length} answered
                  </h1>
                ) : (
                  <h1 className="text-xl font-bold tracking-tight text-foreground">Today's prompts</h1>
                )}
              </div>

              {/* Share buttons */}
              {allTodayAnswered && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-4 space-y-2">
                  <Button className="w-full rounded-xl h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm active:scale-[0.97] transition-transform" onClick={handleCopyChallenge}>
                    {challengeCopied ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Challenge copied!</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Challenge a friend</>}
                  </Button>
                  <Button variant="outline" className="w-full rounded-xl h-9 font-medium text-xs border-border/60 active:scale-[0.97] transition-transform" onClick={handleCopyResults}>
                    {resultsCopied ? <><Check className="h-3 w-3 mr-1.5" /> Results copied!</> : <><Share2 className="h-3 w-3 mr-1.5" /> Share my results</>}
                  </Button>
                </motion.div>
              )}

              {/* Today prompt cards */}
              <div className="space-y-2">
                {todaySummaries.map((s, i) => (
                  <motion.div key={s.prompt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                    {s.answer ? (
                      <button
                        onClick={() => setSelected(s.prompt.id)}
                        className="w-full text-left bg-card border border-border/50 rounded-xl px-5 py-3.5 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-[14px] tracking-tight text-foreground mb-1">
                              {s.prompt.word_a} <span className="text-primary/50">+</span> {s.prompt.word_b}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-muted-foreground/50">
                                → <span className="font-display font-bold text-foreground/70">{s.answer.raw_answer}</span>
                              </span>
                              <span className="text-[9px] text-muted-foreground/30">
                                #{s.rank} · {s.matchCount} {s.matchCount === 1 ? 'match' : 'matches'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors shrink-0" />
                        </div>
                      </button>
                    ) : (
                      <Link
                        to="/play"
                        className="block bg-card border border-border/50 rounded-xl px-5 py-3.5 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-[14px] tracking-tight text-foreground mb-1">
                              {s.prompt.word_a} <span className="text-primary/50">+</span> {s.prompt.word_b}
                            </p>
                            <p className="text-[11px] text-muted-foreground/30">Not answered</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors shrink-0" />
                        </div>
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Continue playing CTA */}
              {!allTodayAnswered && (
                <div className="mt-4">
                  <Button className="w-full rounded-xl h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm" asChild>
                    <Link to="/play">Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
                  </Button>
                </div>
              )}

              {/* Countdown */}
              {allTodayAnswered && (
                <div className="text-center mt-5">
                  <Countdown />
                </div>
              )}
            </motion.div>
          )}

          {/* ─── ARCHIVE HISTORY ─── */}
          {Object.keys(grouped).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-display text-muted-foreground/30 mb-5">Past days</p>

              {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => (
                <div key={date} className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-display text-muted-foreground/40">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/25 font-display tabular-nums">
                      {dailyPlayers[date] ?? 0} players
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ps.map((p, i) => {
                      const answered = submittedMap[p.id];
                      return (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.3 }}
                          onClick={() => setSelected(p.id)}
                          className="w-full text-left flex items-center justify-between bg-card border border-border/60 rounded-xl px-5 py-3.5 transition-all hover:border-primary/20 hover:shadow-sm group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-foreground text-[14px] tracking-tight">
                              {p.word_a} <span className="text-primary/50">+</span> {p.word_b}
                            </p>
                            {answered && userAnswers[p.id] && (
                              <p className="text-[10px] text-muted-foreground/40 mt-1 font-display">
                                → {userAnswers[p.id].raw_answer}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            {answered && <Check className="h-3 w-3 text-primary/60" />}
                            <span className="text-[10px] text-muted-foreground/30 font-display tabular-nums flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" />
                              {totalCounts[p.id] ?? 0}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
