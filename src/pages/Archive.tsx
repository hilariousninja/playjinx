import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import SlidePanel from '@/components/SlidePanel';
import AnswerDrawer from '@/components/AnswerDrawer';
import ArchivePlayCard from '@/components/ArchivePlayCard';
import Countdown from '@/components/Countdown';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';
import { getJinxesForDay, syncJinxesFromResults, isPromptJinx, getPromptJinxCount, promptJinxes } from '@/lib/jinx-tracker';
import {
  getArchivePrompts, ensureDailyPrompts,
  getStats, getCanonicalAnswer,
  getBatchUserAnswers,
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
  statsLoaded: boolean;
}

export default function Archive() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [drawerPrompt, setDrawerPrompt] = useState<PromptSummary | null>(null);
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();

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

      const promptSummaries = await Promise.all(
        allPrompts.map(async (prompt) => {
          const answer = answerMap[prompt.id] ?? null;
          const baseSummary: PromptSummary = {
            prompt,
            answer,
            stats: [],
            total: prompt.total_players || 0,
            rank: 0,
            matchCount: 0,
            percentage: 0,
            userCanonical: null,
          };

          if (!answer) return baseSummary;

          const stats = await getStats(prompt.id);
          const total = prompt.total_players || stats.reduce((a, st) => a + st.count, 0);
          const canon = await getCanonicalAnswer(answer.normalized_answer);
          let userStat = stats.find(st => st.normalized_answer === canon);

          if (!userStat) {
            const { levenshtein } = await import('@/lib/normalize');
            userStat = stats.find(st => {
              const dist = levenshtein(canon, st.normalized_answer);
              return st.normalized_answer.length > 3 && dist <= (st.normalized_answer.length >= 10 ? 2 : 1);
            });
          }

          return {
            ...baseSummary,
            total,
            rank: userStat?.rank ?? 0,
            matchCount: userStat?.count ?? 0,
            percentage: userStat?.percentage ?? 0,
            userCanonical: userStat?.normalized_answer ?? canon,
          };
        })
      );

      syncJinxesFromResults(
        promptSummaries
          .filter(summary => !!summary.answer)
          .map(summary => ({
            promptId: summary.prompt.id,
            date: summary.prompt.date,
            rank: summary.rank,
            matchCount: summary.matchCount,
          }))
      );

      const dateGroups: Record<string, PromptSummary[]> = {};
      for (const summary of promptSummaries) {
        (dateGroups[summary.prompt.date] = dateGroups[summary.prompt.date] || []).push(summary);
      }

      const dayList: DayData[] = Object.entries(dateGroups).map(([date, summaries]) => {

        const playerCount = Math.max(...summaries.map(s => s.total), 0);
        return { date, prompts: summaries, playerCount, isToday: date === todayStr, statsLoaded: false };
      });

      dayList.sort((a, b) => b.date.localeCompare(a.date));
      setDays(dayList);
      setLoading(false);
    })();
  }, []);

  const loadDayStats = useCallback(async (day: DayData) => {
    if (day.statsLoaded) {
      setSelectedDay(day);
      return;
    }

    setLoadingStats(true);
    setSelectedDay(day);

    const enrichedSummaries: PromptSummary[] = await Promise.all(
      day.prompts.map(async (s) => {
        const stats = await getStats(s.prompt.id);
        const total = s.prompt.total_players || stats.reduce((a, st) => a + st.count, 0);

        let rank = 0, matchCount = 0, percentage = 0;
        let userCanonical: string | null = null;

        if (s.answer) {
          const canon = await getCanonicalAnswer(s.answer.normalized_answer);
          let userStat = stats.find(st => st.normalized_answer === canon);
          if (!userStat) {
            const { levenshtein } = await import('@/lib/normalize');
            userStat = stats.find(st => {
              const dist = levenshtein(canon, st.normalized_answer);
              return st.normalized_answer.length > 3 && dist <= (st.normalized_answer.length >= 10 ? 2 : 1);
            });
          }
          userCanonical = userStat?.normalized_answer ?? canon;
          rank = userStat?.rank ?? 0;
          matchCount = userStat?.count ?? 0;
          percentage = userStat?.percentage ?? 0;
        }

        return { ...s, stats, total, rank, matchCount, percentage, userCanonical };
      })
    );

    // Sync jinxes from loaded stats — only true crowd matches qualify now
    syncJinxesFromResults(enrichedSummaries.map(s => ({
      promptId: s.prompt.id,
      date: s.prompt.date,
      rank: s.rank,
      matchCount: s.matchCount,
    })));

    const enrichedDay = { ...day, prompts: enrichedSummaries, playerCount: Math.max(...enrichedSummaries.map(s => s.total), 0), statsLoaded: true };

    setDays(prev => prev.map(d => d.date === day.date ? enrichedDay : d));
    setSelectedDay(enrichedDay);
    setLoadingStats(false);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
    </div>
  );

  const formatDate = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getDaySummary = (day: DayData) => {
    const answered = day.prompts.filter(p => p.answer);
    if (answered.length === 0) return null;
    // Only show "answered" fraction when not all prompts are done.
    // Once complete, the JINX chip (or absence of it) tells the story.
    if (answered.length === day.prompts.length) return null;
    return `${answered.length}/${day.prompts.length}`;
  };

  const renderDayCard = (day: DayData, idx: number) => {
    const hasPlayed = day.prompts.some(p => p.answer);
    const allAnswered = day.prompts.every(p => p.answer);
    const summary = getDaySummary(day);
    // Persistent jinx count from tracker — survives drill-in/out.
    const jinxCount = getJinxesForDay(day.date);

    return (
      <motion.div
        key={day.date}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.03 }}
        className="bg-card rounded-[14px] border border-foreground/[0.08] overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
        onClick={() => loadDayStats(day)}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-[8px] px-[14px] py-[9px] border-b border-foreground/[0.06]">
          <div className="flex items-center gap-[7px] min-w-0">
            <span className="text-[13px] font-semibold text-foreground">{day.isToday ? 'Today' : formatDate(day.date)}</span>
            {day.isToday && !allAnswered && (
              <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[hsl(var(--success))]/12 text-[hsl(var(--success))]">Live</span>
            )}
            {!day.isToday && !hasPlayed && (
              <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-primary/10 text-primary">Play</span>
            )}
          </div>
          <div className="flex items-center gap-[10px] shrink-0">
            {jinxCount > 0 ? (
              <span className="inline-flex items-center gap-[3px] text-[11px] font-semibold text-primary tabular-nums">
                <Zap className="h-[11px] w-[11px]" strokeWidth={2.5} />
                {jinxCount} JINX{jinxCount > 1 ? 'es' : ''}
              </span>
            ) : summary ? (
              <span className="text-[10px] text-muted-foreground font-medium tabular-nums">{summary}</span>
            ) : null}
            <span className="inline-flex items-center gap-[3px] text-[10px] text-muted-foreground/60 tabular-nums">
              <span>👥</span>{day.playerCount}
            </span>
            <span className="text-muted-foreground/40">›</span>
          </div>
        </div>

        {/* Prompt rows — stable 3-slot grid: pair | jinx marker | answer */}
        <div className="flex flex-col gap-[5px] px-[14px] py-[10px]">
          {day.prompts.map(s => {
            const promptIsJinx = isPromptJinx(s.prompt.id);
            const pJinxCount = getPromptJinxCount(s.prompt.id);
            return (
              <div
                key={s.prompt.id}
                className="grid items-center gap-[10px]"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr) 32px' }}
              >
                <span className="text-[12px] font-semibold text-foreground truncate">
                  {s.prompt.word_a}<span className="text-primary font-normal mx-[3px]">+</span>{s.prompt.word_b}
                </span>
                {s.answer ? (
                  <span className="text-[11px] text-[hsl(var(--success))] font-medium truncate">
                    → {s.answer.raw_answer}
                  </span>
                ) : !day.isToday ? (
                  <span className="text-[11px] text-primary font-medium truncate">→ Play</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/50 italic truncate">→ —</span>
                )}
                <span className="flex items-center justify-end text-[10px] font-bold text-primary tabular-nums">
                  {promptIsJinx ? (
                    <span className="inline-flex items-center gap-[1px]" aria-label={`${pJinxCount} JINX`}>
                      <Zap className="h-[10px] w-[10px]" strokeWidth={2.5} />
                      {pJinxCount > 1 ? pJinxCount : ''}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const todayDays = days.filter(d => d.isToday);
  const pastDays = days.filter(d => !d.isToday);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-8">
        <div className="space-y-[10px]">
          {todayDays.map((day, i) => renderDayCard(day, i))}

          {pastDays.length > 0 && (
            <p className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground mt-2 mb-1">
              Past days
            </p>
          )}

          {pastDays.map((day, i) => renderDayCard(day, i))}
        </div>

        {days.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60 mb-3">No archive yet. Play today's prompts to get started.</p>
            <Button className="rounded-xl" asChild>
              <Link to="/play">Play now <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </div>
        )}

        <div className="pt-3">
          <Countdown />
        </div>
      </div>

      <SlidePanel
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay?.isToday ? 'Today' : selectedDay ? formatDate(selectedDay.date) : ''}
        subtitle={selectedDay ? `${selectedDay.prompts.length} prompts · ${selectedDay.playerCount} players` : ''}
      >
        {selectedDay && (
          <div className="px-4 py-4 space-y-[8px]">
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Day JINX summary */}
                {(() => {
                  const dayJinxes = selectedDay.prompts.reduce((s, p) => s + promptJinxes(p.matchCount), 0);
                  const matched = selectedDay.prompts.filter(p => p.matchCount >= 2).length;
                  if (!selectedDay.statsLoaded || dayJinxes === 0) return null;
                  return (
                    <div className="flex items-center gap-[6px] mb-[4px] px-[2px]">
                      <Zap className="h-[14px] w-[14px] text-primary" strokeWidth={2.5} />
                      <span className="text-[13px] font-bold text-primary">{dayJinxes}</span>
                      <span className="text-[11px] text-muted-foreground">
                        JINX{dayJinxes === 1 ? '' : 'es'} · {matched}/{selectedDay.prompts.length} matched
                      </span>
                    </div>
                  );
                })()}

                {selectedDay.prompts.map((s) => (
                  <ArchivePlayCard
                    key={s.prompt.id}
                    summary={s}
                    isToday={selectedDay.isToday}
                    onAnswered={(updated) => {
                      const updatePrompts = (prompts: PromptSummary[]) =>
                        prompts.map(p => p.prompt.id === updated.prompt.id ? updated : p);
                      const updatedDay = { ...selectedDay, prompts: updatePrompts(selectedDay.prompts) };
                      setSelectedDay(updatedDay);
                      setDays(prev => prev.map(d => d.date === selectedDay.date ? { ...d, prompts: updatePrompts(d.prompts) } : d));
                    }}
                    onSeeAll={setDrawerPrompt}
                  />
                ))}

                {selectedDay.isToday && selectedDay.prompts.some(p => !p.answer) && (
                  <Button className="w-full rounded-xl h-11" asChild>
                    <Link to="/play">Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </SlidePanel>

      <AnswerDrawer
        open={!!drawerPrompt}
        onClose={() => setDrawerPrompt(null)}
        promptResult={drawerPrompt}
      />

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
