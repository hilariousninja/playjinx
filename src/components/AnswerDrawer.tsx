import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { promptJinxes, isProvisionalLead } from '@/lib/jinx-tracker';
import type { AnswerStat, DbPrompt, DbAnswer } from '@/lib/store';

interface PromptResult {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  stats: AnswerStat[];
  total: number;
  rank: number;
  matchCount: number;
  percentage: number;
  userCanonical: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  promptResult: PromptResult | null;
}

export default function AnswerDrawer({ open, onClose, promptResult }: Props) {
  if (!promptResult) return null;
  const { prompt, stats, total, userCanonical, rank, matchCount } = promptResult;
  const TOP_N = 10;
  const topStats = stats.slice(0, TOP_N);
  const remaining = stats.slice(TOP_N);
  const maxPct = topStats.length > 0 ? Math.max(...topStats.map(s => s.percentage)) : 100;

  const pJinx = promptJinxes(matchCount);
  const isLeading = isProvisionalLead(rank, matchCount);
  const unanimous = stats.length === 1 && total >= 2;

  // Status line — warmer when there's true crowd consensus
  const statusLine = (() => {
    if (unanimous) return `Everyone said the same thing — ${total} for ${total}.`;
    if (pJinx > 0) return `You matched ${pJinx} other ${pJinx === 1 ? 'player' : 'players'}${rank === 1 ? ' · #1 answer' : ` · #${rank}`}`;
    if (isLeading) return `Leading so far — needs another match to JINX`;
    if (matchCount === 1) return `You're the only one so far on this answer`;
    return null;
  })();

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2 pt-1">
          <DrawerTitle className="text-[15px] font-bold text-center">
            {prompt.word_a} + {prompt.word_b}
          </DrawerTitle>
          <DrawerDescription className="text-[11px] text-muted-foreground text-center">
            {total} {total === 1 ? 'player' : 'players'} · {stats.length} unique
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-5 pb-6">
          {/* Status strip — reinforces the metric model */}
          {statusLine && (
            <div className={`flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] mb-3 ${
              pJinx > 0 ? 'bg-primary/8' : 'bg-muted/40'
            }`}>
              {pJinx > 0 && <Zap className="h-[12px] w-[12px] text-primary shrink-0" strokeWidth={2.5} />}
              {pJinx > 0 && (
                <span className="text-[12px] font-bold text-primary">{pJinx} JINX{pJinx > 1 ? 'es' : ''}</span>
              )}
              <span className="text-[11px] text-foreground/70">{statusLine}</span>
            </div>
          )}

          {/* Top answers */}
          <div className="space-y-1.5">
            {topStats.map((s, i) => {
              const isUser = userCanonical === s.normalized_answer;
              const barWidth = Math.max((s.percentage / maxPct) * 100, 4);

              return (
                <motion.div
                  key={s.normalized_answer}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`relative rounded-lg overflow-hidden ${
                    isUser ? 'bg-primary/[0.08] ring-2 ring-primary/40' : 'hover:bg-muted/30'
                  }`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, delay: i * 0.03 }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${
                      isUser ? 'bg-primary/25' : i === 0 ? 'bg-foreground/[0.04]' : 'bg-foreground/[0.02]'
                    }`}
                  />
                  <div className="relative flex items-center justify-between gap-2 py-2 px-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-display text-[10px] tabular-nums shrink-0 w-4 text-right ${
                        isUser ? 'text-primary font-bold' : 'text-muted-foreground/40'
                      }`}>
                        {s.rank}
                      </span>
                      <span className={`font-display text-[13px] break-words min-w-0 ${
                        isUser ? 'text-foreground font-bold' : 'text-foreground/60 font-medium'
                      }`}>
                        {s.normalized_answer}
                        {isUser && <span className="text-[9px] text-primary font-bold ml-1.5 uppercase">You</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[12px] tabular-nums font-display ${
                        isUser ? 'text-foreground font-bold' : 'text-muted-foreground/40'
                      }`}>
                        {s.percentage}%
                      </span>
                      <span className={`text-[9px] tabular-nums ${isUser ? 'text-muted-foreground/60' : 'text-muted-foreground/20'}`}>
                        ({s.count})
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Long tail chips */}
          {remaining.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-display mb-2">
                + {remaining.length} more answers
              </p>
              <div className="flex flex-wrap gap-1.5">
                {remaining.map(s => (
                  <span
                    key={s.normalized_answer}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      userCanonical === s.normalized_answer
                        ? 'border-primary/30 bg-primary/10 text-primary font-semibold'
                        : 'border-border/50 bg-card text-muted-foreground/60'
                    }`}
                  >
                    {s.normalized_answer}
                    {userCanonical === s.normalized_answer && <span className="text-[8px] ml-1 uppercase">you</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Editorial note */}
          <p className="text-[10px] text-muted-foreground/30 text-center leading-relaxed mt-5">
            Answers are grouped by similarity. Results update as more players answer.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
