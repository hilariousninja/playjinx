import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Calendar, Trophy, Users, Loader2 } from 'lucide-react';
import { getGroupHistory, type GroupHistoryData } from '@/lib/groups';

interface Props {
  groupId: string;
  groupName: string;
}

export default function GroupHistory({ groupId, groupName }: Props) {
  const [data, setData] = useState<GroupHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const h = await getGroupHistory(groupId);
      setData(h);
      setLoading(false);
    })();
  }, [groupId]);

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

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

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
        <div className="space-y-[5px]">
          {data.days.map((day, i) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.03 }}
              className="bg-card rounded-[10px] border border-foreground/[0.06] px-[10px] py-[8px]"
            >
              <div className="flex items-center justify-between mb-[4px]">
                <span className="text-[11px] font-semibold text-foreground">{formatDate(day.date)}</span>
                <div className="flex items-center gap-[8px]">
                  <span className="text-[10px] text-muted-foreground/40">
                    {day.answeredCount}/{day.memberCount} played
                  </span>
                  {day.totalJinxes > 0 && (
                    <span className="flex items-center gap-[3px] text-[10px] font-bold text-primary">
                      <Zap className="h-2.5 w-2.5" />{day.totalJinxes}
                    </span>
                  )}
                </div>
              </div>

              {/* Notable jinxes for this day */}
              {day.jinxPairs.length > 0 && (
                <div className="flex flex-wrap gap-[4px] mt-[3px]">
                  {day.jinxPairs.slice(0, 3).map((j, ji) => (
                    <span
                      key={ji}
                      className="text-[10px] px-[6px] py-[2px] rounded-full bg-primary/6 text-foreground/60"
                    >
                      <span className="font-semibold text-foreground/80">{j.memberA}</span>
                      {' & '}
                      <span className="font-semibold text-foreground/80">{j.memberB}</span>
                      <span className="text-muted-foreground/40 ml-[3px]">"{j.answer}"</span>
                    </span>
                  ))}
                  {day.jinxPairs.length > 3 && (
                    <span className="text-[9px] text-muted-foreground/30 self-center">
                      +{day.jinxPairs.length - 3} more
                    </span>
                  )}
                </div>
              )}
              {day.totalJinxes === 0 && (
                <p className="text-[10px] text-muted-foreground/25 italic">No jinxes this day</p>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
