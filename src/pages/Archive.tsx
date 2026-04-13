import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ChevronRight, Trophy, Target, TrendingUp, Sparkles, Minus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import SlidePanel from '@/components/SlidePanel';
import AnswerDrawer from '@/components/AnswerDrawer';
import Countdown from '@/components/Countdown';
import {
  getArchivePrompts, ensureDailyPrompts,
  getStats, getUserAnswer, getCanonicalAnswer, getTotalSubmissions,
  getBatchUserAnswers, getBatchDailyUniquePlayers,
  type DbPrompt, type DbAnswer, type AnswerStat,
} from '@/lib/store';

interface PromptSummary {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  stats: AnswerStat[];
  total: number;
  rank: number;
  matchCount: number;
  percentage: number;
  userCanonical: string | null;
}

interface DayData {
  date: string;
  prompts: PromptSummary[];
  playerCount: number;
  isToday: boolean;
}

export default function Archive() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [drawerPrompt, setDrawerPrompt] = useState<PromptSummary | null>(null);

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  useEffect(() => {
    (async () => {
      const [archive, today] = await Promise.all([
        getArchivePrompts(),
        ensureDailyPrompts(),
      ]);

      const allPrompts = [...today, ...archive.filter(p => p.date !== todayStr)];
      const allIds = allPrompts.map(p => p.id);
      const { submittedMap, answerMap } = await getBatchUserAnswers(allIds);

      // Group by date
      const dateGroups: Record<string, DbPrompt[]> = {};
      for (const p of allPrompts) {
        (dateGroups[p.date] = dateGroups[p.date] || []).push(p);
      }

      // Build day data
      const dayList: DayData[] = await Promise.all(
        Object.entries(dateGroups).map(async ([date, prompts]) => {
          const summaries: PromptSummary[] = await Promise.all(
            prompts.map(async (prompt) => {
              const answer = answerMap[prompt.id] ?? null;
              const stats = await getStats(prompt.id);
              const total = prompt.total_players || stats.reduce((s, a) => s + a.count, 0);

              let rank = 0, matchCount = 0, percentage = 0;
              let userCanonical: string | null = null;

              if (answer) {
                const canon = await getCanonicalAnswer(answer.normalized_answer);
                let userStat = stats.find(s => s.normalized_answer === canon);
                if (!userStat) {
                  const { levenshtein } = await import('@/lib/normalize');
                  userStat = stats.find(s => {
                    const dist = levenshtein(canon, s.normalized_answer);
                    return s.normalized_answer.length > 3 && dist <= (s.normalized_answer.length >= 10 ? 2 : 1);
                  });
                }
                userCanonical = userStat?.normalized_answer ?? canon;
                rank = userStat?.rank ?? 0;
                matchCount = userStat?.count ?? 0;
                percentage = userStat?.percentage ?? 0;
              }

              return { prompt, answer, stats, total, rank, matchCount, percentage, userCanonical };
            })
          );

          const playerCount = Math.max(...summaries.map(s => s.total), 0);
          return { date, prompts: summaries, playerCount, isToday: date === todayStr };
        })
      );

      dayList.sort((a, b) => b.date.localeCompare(a.date));
      setDays(dayList);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
    </div>
  );

  const getTierBadge = (rank: number, matchCount: number) => {
    if (rank === 1) return { label: '#1', cls: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' };
    if (rank === 2) return { label: '#2', cls: 'bg-primary/15 text-primary' };
    if (rank <= 4) return { label: `#${rank}`, cls: 'bg-muted text-muted-foreground' };
    return null;
  };

  const getVibeForDay = (day: DayData) => {
    const answered = day.prompts.filter(p => p.answer);
    if (answered.length === 0) return { text: 'Not played', dot: 'bg-muted-foreground/30' };
    const avgRank = answered.reduce((s, r) => s + r.rank, 0) / answered.length;
    if (avgRank <= 1.5) return { text: 'Strong crowd read', dot: 'bg-[hsl(var(--success))]' };
    if (avgRank <= 3) return { text: 'Solid instincts', dot: 'bg-primary' };
    return { text: 'Unique thinker', dot: 'bg-muted-foreground' };
  };

  const formatDate = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getStatusPill = (day: DayData) => {
    if (day.isToday) {
      const allAnswered = day.prompts.every(p => p.answer);
      return allAnswered
        ? { label: 'Done', cls: 'bg-muted text-muted-foreground' }
        : { label: 'Live', cls: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' };
    }
    const any = day.prompts.some(p => p.answer);
    if (!any) return { label: 'Missed', cls: 'bg-destructive/10 text-destructive' };
    return { label: 'Done', cls: 'bg-muted text-muted-foreground' };
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader />

      <div className="flex-1 max-w-md mx-auto w-full px-5 pt-6 pb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-lg font-bold tracking-tight text-foreground mb-0.5">Archive</h1>
          <p className="text-[12px] text-muted-foreground/70 mb-5">Your daily JINX history</p>
        </motion.div>

        <div className="space-y-2.5">
          {days.map((day, di) => {
            const vibe = getVibeForDay(day);
            const status = getStatusPill(day);
            const isFirst = di === 0;

            return (
              <motion.button
                key={day.date}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: di * 0.03 }}
                onClick={() => setSelectedDay(day)}
                className="w-full text-left bg-card border border-border/60 rounded-xl px-4 py-3.5 hover:border-primary/20 hover:shadow-sm transition-all group"
              >
                {/* Day header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-foreground">
                      {day.isToday ? 'Today' : formatDate(day.date)}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />
                      {day.playerCount}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                  </div>
                </div>

                {/* Vibe line */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${vibe.dot}`} />
                  <span className="text-[10px] text-muted-foreground/60">{vibe.text}</span>
                </div>

                {/* Prompt preview rows */}
                <div className="space-y-1">
                  {day.prompts.map(s => {
                    const badge = s.answer ? getTierBadge(s.rank, s.matchCount) : null;
                    return (
                      <div key={s.prompt.id} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-display font-semibold text-foreground/70 truncate">
                            {s.prompt.word_a} + {s.prompt.word_b}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {s.answer ? (
                            <>
                              <span className="text-muted-foreground/50 truncate max-w-[60px]">
                                {s.answer.raw_answer}
                              </span>
                              {badge && (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground/30 text-[11px]">
                              {day.isToday ? (
                                <span className="text-primary/60">Explore →</span>
                              ) : 'Missed'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>

        {days.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No archive yet. Play today's prompts to get started.</p>
            <Button className="mt-3 rounded-xl" asChild>
              <Link to="/play">Play now <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </div>
        )}
      </div>

      {/* Day detail panel */}
      <SlidePanel
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay?.isToday ? 'Today' : selectedDay ? formatDate(selectedDay.date) : ''}
        subtitle={selectedDay ? `${selectedDay.playerCount} players` : ''}
      >
        {selectedDay && (
          <div className="px-5 py-4 space-y-4">
            {/* Vibe */}
            {(() => {
              const vibe = getVibeForDay(selectedDay);
              return (
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${vibe.dot}`} />
                  <span className="text-[12px] text-muted-foreground">{vibe.text}</span>
                </div>
              );
            })()}

            {/* Per-prompt cards */}
            {selectedDay.prompts.map((s, i) => {
              const badge = s.answer ? getTierBadge(s.rank, s.matchCount) : null;
              const barWidth = s.total > 0 && s.matchCount > 0
                ? Math.max(Math.round((s.matchCount / s.total) * 100), 4) : 0;

              return (
                <div key={s.prompt.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[10px] font-display text-muted-foreground/50 mb-2">
                    {s.prompt.word_a} + {s.prompt.word_b}
                  </p>

                  {s.answer ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-display font-bold text-foreground">
                            {s.answer.raw_answer}
                          </span>
                          <span className="text-[9px] text-primary font-bold uppercase">You</span>
                        </div>
                        {badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <div className="relative h-5 rounded-lg bg-muted/50 overflow-hidden mb-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded-lg bg-primary/25"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-display font-bold text-foreground/50">
                          {s.percentage}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground/40 mb-2">
                      {selectedDay.isToday ? 'Not answered yet' : 'Missed'}
                    </p>
                  )}

                  <button
                    onClick={() => setDrawerPrompt(s)}
                    className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"
                  >
                    See all {s.stats.length} answers <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {selectedDay.isToday && selectedDay.prompts.some(p => !p.answer) && (
              <Button className="w-full rounded-xl h-10" asChild>
                <Link to="/play">Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
              </Button>
            )}

            <div className="pt-2">
              <Countdown />
            </div>
          </div>
        )}
      </SlidePanel>

      {/* Nested answer drawer */}
      <AnswerDrawer
        open={!!drawerPrompt}
        onClose={() => setDrawerPrompt(null)}
        promptResult={drawerPrompt}
      />

      <footer className="border-t border-border py-3 pb-20 md:pb-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
      <MobileBottomNav />
    </div>
  );
}
