import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import SlidePanel from '@/components/SlidePanel';
import {
  getJinxTotal,
  getJinxesThisWeek,
  getJinxesThisMonth,
  getJinxesThisYear,
  getBestDay,
  getJinxDayCount,
} from '@/lib/jinx-tracker';

interface Props {
  open: boolean;
  onClose: () => void;
  displayName: string | null;
}

const formatBestDate = (date: string) => {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function ProfileStatsPanel({ open, onClose, displayName }: Props) {
  const [stats, setStats] = useState({
    total: 0, week: 0, month: 0, year: 0, dayCount: 0,
    best: null as { date: string; count: number } | null,
  });

  useEffect(() => {
    if (!open) return;
    setStats({
      total: getJinxTotal(),
      week: getJinxesThisWeek(),
      month: getJinxesThisMonth(),
      year: getJinxesThisYear(),
      dayCount: getJinxDayCount(),
      best: getBestDay(),
    });
  }, [open]);

  const initial = useMemo(() => (displayName ? displayName.charAt(0).toUpperCase() : '?'), [displayName]);

  const rows: { label: string; value: string | number }[] = [
    { label: 'This week', value: stats.week },
    { label: 'This month', value: stats.month },
    { label: 'This year', value: stats.year },
    { label: 'JINX days', value: stats.dayCount },
    { label: 'Best day', value: stats.best ? `${stats.best.count} · ${formatBestDate(stats.best.date)}` : '—' },
  ];

  return (
    <SlidePanel open={open} onClose={onClose} title={displayName || 'Your record'} subtitle="Personal JINX stats">
      <div className="px-4 py-5 space-y-5">
        {/* Identity hero */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--logo-accent))] to-[hsl(var(--primary))] flex items-center justify-center text-[18px] font-bold text-white shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-foreground truncate">{displayName || 'Anonymous player'}</div>
            <div className="text-[11px] text-muted-foreground">Your cumulative JINX record</div>
          </div>
        </div>

        {/* Total hero */}
        <div className="rounded-[14px] border border-primary/15 bg-primary/[0.06] px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-primary leading-none">{stats.total}</span>
              <span className="text-[12px] font-semibold text-primary/80">Total JINX{stats.total === 1 ? '' : 'es'}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">All-time overlaps with other players</div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="rounded-[14px] border border-foreground/[0.08] divide-y divide-foreground/[0.06] overflow-hidden">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-muted-foreground">{r.label}</span>
              <span className="text-[13px] font-semibold text-foreground">{r.value}</span>
            </div>
          ))}
        </div>

        {stats.total === 0 && (
          <p className="text-[11px] text-muted-foreground text-center px-2">
            Play today's prompts and overlap with other players to start earning JINXes.
          </p>
        )}
      </div>
    </SlidePanel>
  );
}
