import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Calendar, Loader2, ChevronDown } from 'lucide-react';
import { getGroupHistory, type GroupHistoryData, type GroupDaySnapshot } from '@/lib/groups';
import { getDisplayName } from '@/lib/challenge-room';
import PromptPair from './PromptPair';

interface Props {
  groupId: string;
  groupName: string;
}

const PAGE_DAYS = 14;

export default function GroupHistory({ groupId, groupName }: Props) {
  const [data, setData] = useState<GroupHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const h = await getGroupHistory(groupId, { daysWindow: PAGE_DAYS });
      setData(h);
      const firstActive = h.days.find(d => d.totalJinxes > 0) ?? h.days[0];
      if (firstActive) setExpanded(new Set([firstActive.date]));
      setLoading(false);
    })();
  }, [groupId]);

  const loadOlder = async () => {
    if (!data || !data.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      // Load the next window ending where the current one started
      const before = data.oldestLoadedDate ?? new Date().toISOString().slice(0, 10);
      const more = await getGroupHistory(groupId, { daysWindow: PAGE_DAYS, before });

      // Merge: append new days, dedupe by date, recompute aggregates locally
      const seen = new Set(data.days.map(d => d.date));
      const mergedDays = [
        ...data.days,
        ...more.days.filter(d => !seen.has(d.date)),
      ].sort((a, b) => b.date.localeCompare(a.date));

      // Merge member stats (sum)
      const statMap = new Map(data.memberStats.map(m => [m.session_id, { ...m }]));
      for (const m of more.memberStats) {
        const existing = statMap.get(m.session_id);
        if (existing) {
          existing.totalJinxes += m.totalJinxes;
          existing.daysPlayed += m.daysPlayed;
        } else {
          statMap.set(m.session_id, { ...m });
        }
      }
      const memberStats = Array.from(statMap.values()).sort((a, b) => b.totalJinxes - a.totalJinxes);

      setData({
        days: mergedDays,
        memberStats,
        totalDaysActive: mergedDays.length,
        bestPair: data.bestPair, // keep original best pair (most relevant)
        hasMore: more.hasMore,
        oldestLoadedDate: more.oldestLoadedDate ?? data.oldestLoadedDate,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return (
    <div className="py-10 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
    </div>
  );

  if (!data || data.days.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Calendar className="h-5 w-5 text-muted-foreground/30 mx-auto" />
        <p className="text-[12px] text-muted-foreground/50">No history yet</p>
        <p className="text-[11px] text-muted-foreground/30">Play together for a few days and your group story will appear here.</p>
      </div>
    );
  }

  const toggle = (date: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const myName = getDisplayName() || '';

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {(data.bestPair || data.totalDaysActive > 1) && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-[6px] overflow-x-auto pb-1"
        >
          {data.bestPair && (
            <div className="shrink-0 flex items-center gap-[6px] px-3 py-[7px] rounded-[10px] bg-primary/8 border border-primary/10">
              <Zap className="h-3 w-3 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground/50 leading-none mb-[2px]">Best pair</p>
                <p className="text-[11px] font-bold text-foreground leading-tight truncate">
                  {data.bestPair.nameA} & {data.bestPair.nameB}
                </p>
                <p className="text-[9px] text-primary font-semibold leading-none mt-[1px]">
                  {data.bestPair.jinxCount} JINX{data.bestPair.jinxCount !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
          )}
          <div className="shrink-0 flex items-center gap-[6px] px-3 py-[7px] rounded-[10px] bg-muted/60 border border-foreground/[0.06]">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground/50 leading-none mb-[2px]">Active days</p>
              <p className="text-[11px] font-bold text-foreground leading-tight">{data.totalDaysActive}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Member leaderboard */}
      {data.memberStats.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px]">Members</p>
          <div className="bg-card rounded-[10px] border border-foreground/[0.06] overflow-hidden">
            {data.memberStats.map((m, i) => (
              <div
                key={m.session_id}
                className={`flex items-center gap-[8px] px-[10px] py-[7px] ${i > 0 ? 'border-t border-foreground/[0.04]' : ''}`}
              >
                <span className="text-[10px] tabular-nums text-muted-foreground/30 w-[14px] text-right shrink-0">{i + 1}</span>
                <span className="text-[12px] font-semibold text-foreground truncate flex-1">{m.display_name}</span>
                <div className="flex items-center gap-[8px] shrink-0">
                  <span className="text-[10px] text-muted-foreground/40">{m.daysPlayed}d</span>
                  <span className="text-[11px] font-bold text-primary tabular-nums">
                    {m.totalJinxes} <span className="text-[9px] font-normal text-muted-foreground/40">jinx</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Day-by-day history */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px]">Past days</p>
        <div className="space-y-[6px]">
          {data.days.map((day, i) => (
            <DayCard
              key={day.date}
              day={day}
              index={i}
              isExpanded={expanded.has(day.date)}
              onToggle={() => toggle(day.date)}
              formatDate={formatDate}
              myName={myName}
            />
          ))}
        </div>

        {/* Load older days */}
        {data.hasMore ? (
          <button
            onClick={loadOlder}
            disabled={loadingMore}
            className="mt-[10px] w-full flex items-center justify-center gap-[6px] py-[10px] text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-[10px] border border-dashed border-foreground/[0.08] hover:border-foreground/20 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Loading…</>
            ) : (
              <>See older days</>
            )}
          </button>
        ) : data.days.length > PAGE_DAYS ? (
          <p className="mt-[10px] text-center text-[10px] text-muted-foreground/40">That's all your group history.</p>
        ) : null}
      </motion.div>
    </div>
  );
}

interface DayCardProps {
  day: GroupDaySnapshot;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (d: string) => string;
  myName: string;
}

function DayCard({ day, index, isExpanded, onToggle, formatDate, myName }: DayCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.03 }}
      className="bg-card rounded-[10px] border border-foreground/[0.06] overflow-hidden"
    >
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-[10px] py-[9px] text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-[8px] min-w-0 flex-1">
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="text-[11px] font-semibold text-foreground">{formatDate(day.date)}</span>
        </div>
        <div className="flex items-center gap-[8px] shrink-0">
          <span className="text-[10px] text-muted-foreground/40">
            {day.answeredCount}/{day.memberCount} played
          </span>
          {day.totalJinxes > 0 ? (
            <span className="flex items-center gap-[3px] text-[10px] font-bold text-primary tabular-nums">
              <Zap className="h-2.5 w-2.5" />{day.totalJinxes}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/25">—</span>
          )}
        </div>
      </button>

      {/* Expanded prompt details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-[10px] pb-[10px] pt-[2px] space-y-[8px] border-t border-foreground/[0.04]">
              {day.prompts.length === 0 && (
                <p className="text-[11px] text-muted-foreground/40 italic pt-2">No prompts recorded</p>
              )}
              {day.prompts.map(p => (
                <div key={p.prompt_id} className="rounded-[8px] bg-muted/30 border border-foreground/[0.04] overflow-hidden">
                  <div className="px-[10px] pt-[8px] pb-[4px]">
                    <PromptPair wordA={p.word_a} wordB={p.word_b} size="sm" />
                  </div>
                  <div className="px-[8px] pb-[8px] space-y-[3px]">
                    {p.clusters.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/40 italic px-2 py-1">No one answered</p>
                    ) : p.clusters.map(cluster => {
                      const isJinx = cluster.members.length >= 2;
                      const isMine = !!myName && cluster.members.includes(myName);
                      return (
                        <div
                          key={cluster.answer}
                          className={`flex items-start justify-between gap-2 px-[8px] py-[5px] rounded-[6px] ${
                            isJinx ? 'bg-primary/8' : 'bg-background/60'
                          }`}
                        >
                          <div className="flex items-center gap-[5px] min-w-0 flex-1">
                            {isJinx && <Zap className="h-2.5 w-2.5 text-primary shrink-0 mt-[2px]" />}
                            <span className={`text-[11px] font-semibold break-words ${
                              isMine ? 'text-foreground' : 'text-foreground/75'
                            }`}>
                              {cluster.answer}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-[3px] justify-end shrink-0 max-w-[55%]">
                            {cluster.members.map(name => (
                              <span
                                key={name}
                                className={`text-[9px] px-[5px] py-[1px] rounded-full ${
                                  name === myName
                                    ? 'bg-primary/15 text-primary font-bold'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
