import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import SlidePanel from '@/components/SlidePanel';
import AnswerDrawer from '@/components/AnswerDrawer';
import Countdown from '@/components/Countdown';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';
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

      const dateGroups: Record<string, DbPrompt[]> = {};
      for (const p of allPrompts) {
        (dateGroups[p.date] = dateGroups[p.date] || []).push(p);
      }

      // Build day list WITHOUT loading stats - use prompt table data only
      const dayList: DayData[] = Object.entries(dateGroups).map(([date, prompts]) => {
        const summaries: PromptSummary[] = prompts.map((prompt) => {
          const answer = answerMap[prompt.id] ?? null;
          return {
            prompt,
            answer,
            stats: [],
            total: prompt.total_players || 0,
            rank: 0,
            matchCount: 0,
            percentage: 0,
            userCanonical: null,
          };
        });

        const playerCount = Math.max(...summaries.map(s => s.total), 0);
        return { date, prompts: summaries, playerCount, isToday: date === todayStr, statsLoaded: false };
      });

      dayList.sort((a, b) => b.date.localeCompare(a.date));
      setDays(dayList);
      setLoading(false);
    })();
  }, []);

  // Load stats for a specific day when opened
  const loadDayStats = useCallback(async (day: DayData) => {
    if (day.statsLoaded) {
      setSelectedDay(day);
      return;
    }

    setLoadingStats(true);
    setSelectedDay(day); // Show panel immediately with loading state

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

    const enrichedDay = { ...day, prompts: enrichedSummaries, playerCount: Math.max(...enrichedSummaries.map(s => s.total), 0), statsLoaded: true };

    // Update in days list so reopening is instant
    setDays(prev => prev.map(d => d.date === day.date ? enrichedDay : d));
    setSelectedDay(enrichedDay);
    setLoadingStats(false);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
    </div>
  );

  const getVibeForDay = (day: DayData) => {
    const answered = day.prompts.filter(p => p.answer);
    if (answered.length === 0) return { text: 'What did the crowd say?', dotCls: 'bg-primary/50' };
    if (!day.statsLoaded) return { text: `${answered.length} answered`, dotCls: 'bg-primary' };
    const tops = answered.filter(r => r.rank === 1).length;
    const avgRank = answered.reduce((s, r) => s + r.rank, 0) / answered.length;
    if (avgRank <= 1.5) return { text: `Strong consensus · ${tops} top pick${tops > 1 ? 's' : ''}`, dotCls: 'bg-[hsl(var(--success))]' };
    if (avgRank <= 3) return { text: 'Solid instincts', dotCls: 'bg-primary' };
    return { text: 'Unique thinker', dotCls: 'bg-muted-foreground' };
  };

  const formatDate = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const renderDayCard = (day: DayData, idx: number) => {
    const vibe = getVibeForDay(day);
    const hasPlayed = day.prompts.some(p => p.answer);
    const allAnswered = day.prompts.every(p => p.answer);

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
        <div className="flex items-center justify-between px-[14px] py-[11px] border-b border-foreground/[0.06]">
          <div className="flex items-center gap-[7px]">
            <span className="text-[13px] font-semibold text-foreground">{day.isToday ? 'Today' : formatDate(day.date)}</span>
            {day.isToday && (
              <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[hsl(var(--success))]/12 text-[hsl(var(--success))]">Live</span>
            )}
            {day.isToday && allAnswered && (
              <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-primary/12 text-[hsl(var(--warning-foreground))]">Done</span>
            )}
           {!day.isToday && !hasPlayed && (
              <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-primary/10 text-primary">Browse</span>
            )}
          </div>
          <div className="flex items-center gap-[6px]">
            <span className="text-[10px] text-muted-foreground">👥 {day.playerCount}</span>
            <span className="text-muted-foreground/40">›</span>
          </div>
        </div>

        {/* Vibe */}
        <div className="flex items-center gap-[6px] px-[14px] py-[8px]">
          <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${vibe.dotCls}`} />
          <span className={`text-[11px] ${hasPlayed ? 'text-muted-foreground' : 'text-foreground/50'}`}>{vibe.text}</span>
        </div>

        {/* Prompt rows */}
        <div className="flex flex-col gap-[5px] px-[14px] pb-[12px]">
          {day.prompts.map(s => (
            <div key={s.prompt.id} className="flex items-center gap-[8px]">
              <span className="text-[12px] font-semibold text-foreground flex-1 truncate">
                {s.prompt.word_a}<span className="text-primary font-normal mx-[3px]">+</span>{s.prompt.word_b}
              </span>
              {s.answer ? (
                <span className="text-[11px] text-[hsl(var(--success))] font-medium whitespace-nowrap">
                  → {s.answer.raw_answer}
                </span>
              ) : !day.isToday ? (
                <span className="text-[11px] text-primary font-medium whitespace-nowrap">Explore →</span>
              ) : (
                <span className="text-[11px] text-muted-foreground/50 italic whitespace-nowrap">—</span>
              )}
              {s.answer && s.rank > 0 && (
                <span className={`text-[9px] font-semibold px-[6px] py-[2px] rounded-[5px] whitespace-nowrap shrink-0 ${
                  s.rank === 1 ? 'bg-[hsl(var(--success))]/12 text-[hsl(142_72%_30%)]' :
                  s.rank === 2 ? 'bg-primary/12 text-[hsl(var(--warning-foreground))]' :
                  'bg-muted text-muted-foreground'
                }`}>
                  #{s.rank}
                </span>
              )}
            </div>
          ))}
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
            {(() => {
              const vibe = getVibeForDay(selectedDay);
              return (
                <div className="flex items-center gap-[6px] mb-[12px]">
                  <div className={`w-[5px] h-[5px] rounded-full ${vibe.dotCls}`} />
                  <span className="text-[11px] text-muted-foreground">{vibe.text}</span>
                </div>
              );
            })()}

            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              selectedDay.prompts.map((s) => {
                const barWidth = s.total > 0 && s.matchCount > 0
                  ? Math.max(Math.round((s.matchCount / s.total) * 100), 4) : 0;
                const rnkCls = s.rank === 1 ? 'bg-[hsl(var(--success))]/10 text-[hsl(142_72%_30%)]'
                  : s.rank === 2 ? 'bg-primary/10 text-[hsl(var(--warning-foreground))]'
                  : 'bg-muted text-muted-foreground';

                return (
                  <div key={s.prompt.id} className="bg-card rounded-[13px] border border-foreground/[0.08] p-[13px]">
                    <div className="flex items-center justify-between mb-[6px]">
                      <span className="text-[14px] font-bold text-foreground">
                        {s.prompt.word_a} <span className="text-primary font-normal mx-1">+</span> {s.prompt.word_b}
                      </span>
                      {s.answer && (
                        <span className={`text-[10px] font-semibold px-[6px] py-[2px] rounded-[6px] ${rnkCls}`}>
                          #{s.rank}
                        </span>
                      )}
                    </div>

                    {s.answer ? (
                      <div className="flex items-center gap-[6px] mb-[7px]">
                        <span className="text-[17px] font-bold text-foreground">{s.answer.raw_answer}</span>
                        <span className="text-[9px] font-semibold bg-primary text-white px-[5px] py-[2px] rounded">you</span>
                        <div className="flex-1 bg-muted/40 rounded h-4 overflow-hidden ml-1">
                          <div className="h-full rounded" style={{ width: `${barWidth}%`, background: s.rank === 1 ? 'hsl(var(--success) / 0.12)' : s.rank === 2 ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--foreground) / 0.06)' }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.percentage}%</span>
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground mb-[7px]">
                        {selectedDay.isToday ? 'Not answered yet' : 'You missed this one — see what the crowd said'}
                      </p>
                    )}

                    <button
                      onClick={() => setDrawerPrompt(s)}
                      className="w-full bg-transparent border-none border-t border-foreground/[0.08] pt-[7px] text-[11px] text-primary font-medium cursor-pointer text-left flex items-center justify-between"
                    >
                      <span>See all answers</span>
                      <span>→</span>
                    </button>
                  </div>
                );
              })
            )}

            {selectedDay.isToday && selectedDay.prompts.some(p => !p.answer) && (
              <Button className="w-full rounded-xl h-11" asChild>
                <Link to="/play">Continue playing <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
              </Button>
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
