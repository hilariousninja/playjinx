import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Send, Check, Loader2, ChevronRight, Zap, ArrowRight, Trophy, Target, TrendingUp, Sparkles, Minus } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getArchivePrompts, ensureDailyPrompts, hasSubmitted, getTotalSubmissions,
  submitAnswer, getUserAnswer, getDailyUniquePlayers, getStats, getCanonicalAnswer,
  getBatchUserAnswers, getBatchDailyUniquePlayers,
  type DbPrompt, type DbAnswer, type AnswerStat,
} from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import ResultsView from '@/components/ResultsView';
import Countdown from '@/components/Countdown';
import AppHeader from '@/components/AppHeader';
import { toast } from '@/hooks/use-toast';

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

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  const loadData = async () => {
    const [archive, today] = await Promise.all([
      getArchivePrompts(),
      ensureDailyPrompts(),
    ]);

    setTodayPrompts(today);
    const pastOnly = archive.filter(p => p.date !== todayStr);
    setArchivePrompts(pastOnly);

    const allPrompts = [...today, ...pastOnly];
    const allIds = allPrompts.map(p => p.id);
    const { submittedMap: subMap, answerMap: ansMap } = await getBatchUserAnswers(allIds);

    const totals: Record<string, number> = {};
    for (const p of allPrompts) totals[p.id] = p.total_players ?? 0;

    setSubmittedMap(subMap);
    setUserAnswers(ansMap);
    setTotalCounts(totals);

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

    const pastIds = pastOnly.map(p => p.id);
    const perPromptPlayers = await getBatchDailyUniquePlayers(pastIds);
    const dpMap: Record<string, number> = {};
    for (const p of pastOnly) {
      if (!dpMap[p.date]) dpMap[p.date] = 0;
      dpMap[p.date] = Math.max(dpMap[p.date], perPromptPlayers[p.id] ?? p.total_players ?? 0);
    }
    setDailyPlayers(dpMap);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
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

  const getMatchTier = (s: PromptSummary) => {
    if (!s.answer) return null;
    const isBest = s.rank === 1;
    if (isBest) return { label: 'Strongest hit', icon: Trophy, color: 'text-[hsl(var(--match-best))]', bg: 'bg-[hsl(var(--match-best)/0.08)]' };
    if (s.rank <= 2) return { label: 'Strong', icon: Target, color: 'text-[hsl(var(--match-strong))]', bg: 'bg-[hsl(var(--match-strong)/0.08)]' };
    if (s.rank <= 4) return { label: 'Good', icon: TrendingUp, color: 'text-[hsl(var(--match-good))]', bg: 'bg-[hsl(var(--match-good)/0.08)]' };
    if (s.matchCount > 1) return { label: 'Decent', icon: Sparkles, color: 'text-[hsl(var(--match-decent))]', bg: 'bg-[hsl(var(--match-decent)/0.08)]' };
    return { label: 'Unique', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50' };
  };

  const bestHit = allTodayAnswered
    ? todaySummaries.reduce((best, s) => s.matchCount > best.matchCount ? s : best, todaySummaries[0])
    : null;

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
              <span className="font-display font-bold tracking-tighter text-foreground">JINX</span>
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
      <AppHeader />

      <div className="flex-1">
        <div className="max-w-[22rem] mx-auto px-5 pt-6 pb-8 w-full">

          {/* ─── TODAY SUMMARY ─── */}
          {todayPrompts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              {/* Today header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-foreground">Today</h1>
                  {!allTodayAnswered ? (
                    <span className="text-[7px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-display font-bold flex items-center gap-0.5">
                      <Zap className="h-2 w-2" /> Live
                    </span>
                  ) : (
                    <span className="text-[7px] bg-primary/8 text-primary/60 px-1.5 py-0.5 rounded-full font-display font-bold">
                      Complete
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-display tabular-nums">
                  {todayAnsweredCount}/{todaySummaries.length}
                </span>
              </div>

              {/* Today prompt cards */}
              <div className="space-y-2">
                {todaySummaries.map((s, i) => {
                  const tier = getMatchTier(s);
                  const isBestHit = bestHit && s.prompt.id === bestHit.prompt.id;
                  const TIcon = tier?.icon;

                  return (
                  <motion.div key={s.prompt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                    {s.answer ? (
                      <button
                        onClick={() => setSelected(s.prompt.id)}
                        className={`w-full text-left bg-card border rounded-xl px-4 py-3 hover:border-primary/20 transition-all group ${
                          isBestHit && allTodayAnswered ? 'border-[hsl(var(--match-best)/0.2)] shadow-[0_0_0_1px_hsl(var(--match-best)/0.05)]' : 'border-border/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-[14px] tracking-tight text-foreground">
                              {s.prompt.word_a} <span className="text-primary/50">+</span> {s.prompt.word_b}
                            </p>
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-display">
                              → {s.answer.raw_answer}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {tier && TIcon && (
                              <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                                <TIcon className="h-2 w-2" />
                                {tier.label}
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <Link
                        to="/play"
                        className="block bg-card border border-border/60 rounded-xl px-4 py-3 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-[14px] tracking-tight text-foreground">
                              {s.prompt.word_a} <span className="text-primary/50">+</span> {s.prompt.word_b}
                            </p>
                            <p className="text-[10px] text-muted-foreground/40 mt-1">Tap to play</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-primary/40 group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </Link>
                    )}
                  </motion.div>
                  );
                })}
              </div>

              {/* Continue playing CTA */}
              {!allTodayAnswered && (
                <div className="mt-3">
                  <Button className="w-full rounded-xl h-10 font-semibold text-sm" asChild>
                    <Link to="/play">Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
                  </Button>
                </div>
              )}

              {/* All done: countdown */}
              {allTodayAnswered && (
                <p className="text-center text-[9px] text-muted-foreground/40 mt-4">
                  <Countdown />
                </p>
              )}
            </motion.div>
          )}

          {/* ─── PAST DAYS ─── */}
          {Object.keys(grouped).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-border/50" />
                <p className="text-[9px] uppercase tracking-widest font-display text-muted-foreground/40">Past days</p>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => {
                const dayPlayerCount = dailyPlayers[date] ?? 0;
                const dayAnswered = ps.filter(p => submittedMap[p.id]).length;
                return (
                <div key={date} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-widest font-display text-muted-foreground/50 font-semibold">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground/40 font-display tabular-nums">
                      {dayPlayerCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {dayPlayerCount}
                        </span>
                      )}
                      <span>{dayAnswered}/{ps.length}</span>
                    </div>
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
                          className="w-full text-left flex items-center justify-between bg-card border border-border/60 rounded-xl px-4 py-3 transition-all hover:border-primary/20 hover:shadow-sm group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-foreground text-[14px] tracking-tight">
                              {p.word_a} <span className="text-primary/50">+</span> {p.word_b}
                            </p>
                            {answered && userAnswers[p.id] ? (
                              <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-display">
                                → {userAnswers[p.id].raw_answer}
                              </p>
                            ) : !answered ? (
                              <p className="text-[10px] text-muted-foreground/40 mt-0.5">Not answered</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {answered && (
                              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/8 text-primary/60">
                                <Check className="h-2 w-2" /> Played
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-3 pb-20 md:pb-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
      <MobileBottomNav />
    </div>
  );
}
