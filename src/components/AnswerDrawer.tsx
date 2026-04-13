import SlidePanel from '@/components/SlidePanel';
import { motion } from 'framer-motion';
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
  const { prompt, stats, total, userCanonical } = promptResult;
  const TOP_N = 10;
  const topStats = stats.slice(0, TOP_N);
  const remaining = stats.slice(TOP_N);
  const maxPct = topStats.length > 0 ? Math.max(...topStats.map(s => s.percentage)) : 100;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={`${prompt.word_a} + ${prompt.word_b}`}
      subtitle={`${total} answers · ${stats.length} unique`}
      zIndex={50}
    >
      <div className="px-5 py-4 space-y-1.5">
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
                isUser ? 'bg-primary/[0.06] ring-1 ring-primary/15' : 'hover:bg-muted/30'
              }`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className={`absolute inset-y-0 left-0 rounded-lg ${
                  isUser ? 'bg-primary/20' : i === 0 ? 'bg-foreground/[0.04]' : 'bg-foreground/[0.02]'
                }`}
              />
              <div className="relative flex items-center justify-between gap-2 py-2 px-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display text-[10px] tabular-nums shrink-0 w-4 text-right text-muted-foreground/40">
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
                  <span className="text-[9px] tabular-nums text-muted-foreground/20">({s.count})</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Long tail chips */}
      {remaining.length > 0 && (
        <div className="px-5 pb-5">
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
      <div className="px-5 pb-6">
        <p className="text-[10px] text-muted-foreground/30 text-center leading-relaxed">
          Answers are grouped by similarity. Results update as more people play.
        </p>
      </div>
    </SlidePanel>
  );
}
