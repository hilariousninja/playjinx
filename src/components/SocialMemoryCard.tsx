import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Users, TrendingUp, Share2 } from 'lucide-react';
import { getSocialInsights, type SocialInsight } from '@/lib/social-memory';

interface Props {
  /** Trigger a refresh (e.g. after recording matches) */
  refreshKey?: number;
  /** Compact mode for inline placement */
  compact?: boolean;
}

export default function SocialMemoryCard({ refreshKey = 0, compact = false }: Props) {
  const [insights, setInsights] = useState<SocialInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSocialInsights();
        setInsights(data);
      } catch {
        // silently fail
      }
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading || !insights) return null;

  // No data at all — show empty state prompting social play
  if (!insights.hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-center"
      >
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="text-[11px] font-display font-semibold text-muted-foreground/50 uppercase tracking-[0.1em]">
            Match history
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground/50">
          Share today's JINX to start building your match history
        </p>
      </motion.div>
    );
  }

  const { todayMatches, weeklyBest, recurring, todayPeopleCount } = insights;

  // No matches today but have historical data
  if (todayMatches.length === 0 && !weeklyBest && recurring.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-center"
      >
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="text-[11px] font-display font-semibold text-muted-foreground/50 uppercase tracking-[0.1em]">
            Match history
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground/50">
          No shared matches yet today — play with friends to see who you think like
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary/60" />
        <span className="text-[11px] font-display font-bold text-muted-foreground/60 uppercase tracking-[0.1em]">
          Your matches
        </span>
      </div>

      <div className={`px-4 pb-3 space-y-2 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
        {/* Today's matches */}
        {todayMatches.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium">
              {todayMatches.length === 1 ? 'Closest match today' : 'Matched with today'}
            </p>
            {todayMatches.slice(0, 3).map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="font-display font-semibold text-foreground/80">{m.name}</span>
                <span className="text-primary font-display font-bold text-[11px]">
                  {m.matched}/{m.total}
                </span>
              </div>
            ))}
            {todayMatches.length > 3 && (
              <p className="text-[10px] text-muted-foreground/30">
                +{todayMatches.length - 3} more
              </p>
            )}
          </div>
        )}

        {/* Weekly best — only if enough data */}
        {weeklyBest && (
          <div className="pt-1 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium mb-0.5">
              Closest match this week
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-[hsl(var(--match-best))]" />
              <span className="font-display font-semibold text-foreground/80">{weeklyBest.name}</span>
              <span className="text-[10px] text-primary font-display font-bold ml-auto">
                {weeklyBest.totalMatched} JINXes across {weeklyBest.days} days
              </span>
            </div>
          </div>
        )}

        {/* Recurring overlap — only if meaningful (2+ matches) */}
        {recurring.length > 0 && !weeklyBest && (
          <div className="pt-1 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium mb-0.5">
              Recurring overlap
            </p>
            {recurring.filter(r => r.totalMatched > 0).slice(0, 2).map((r) => (
              <p key={r.name} className="text-foreground/70 font-display">
                You and <span className="font-semibold">{r.name}</span> JINXed {r.totalMatched} times this week
              </p>
            ))}
            {recurring.filter(r => r.totalMatched > 0).length === 0 && (
              <p className="text-[12px] text-muted-foreground/50">
                Play with your group to build match history
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
