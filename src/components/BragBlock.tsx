import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface Props {
  answeredCount: number;
  totalCount: number;
  vibeLabel: string;
  vibeColor: string;
  bestAnswer?: string;
  bestPct?: number;
  /** matched prompts: prompts with overlap (>=1 other player matched) */
  matchedPrompts: number;
  /** total JINXes today (sum of cluster_size - 1 across the day's prompts) */
  totalJinxes: number;
  /** prompts where my answer was the largest cluster AND had real overlap */
  topAnswers?: number;
}

export default function BragBlock({
  answeredCount,
  totalCount,
  bestAnswer,
  bestPct,
  matchedPrompts,
  totalJinxes,
}: Props) {
  // Hero headline = OVERALL SYNC across the day, not JINX language.
  const headline = (() => {
    if (answeredCount < totalCount) return `You answered ${answeredCount} of ${totalCount}.`;
    if (matchedPrompts === totalCount && totalCount > 0) return `Matched on all ${totalCount}.`;
    if (matchedPrompts === 0) return `Day complete.`;
    return `${matchedPrompts}/${totalCount} in sync.`;
  })();

  const subline = (() => {
    if (answeredCount < totalCount) return 'Finish today to see how you synced.';
    if (matchedPrompts === totalCount && totalCount > 0) return 'Perfect sync day — you matched the crowd everywhere.';
    if (matchedPrompts === 0 && totalJinxes === 0) return 'No overlap with the crowd today.';
    if (matchedPrompts === 1) return 'One prompt synced with the crowd.';
    return `Synced with the crowd on ${matchedPrompts} of ${totalCount}.`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-foreground text-white rounded-2xl p-[18px] overflow-hidden"
    >
      {/* Decorative X watermark */}
      <svg
        className="absolute right-[-8px] top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none"
        width="80" height="80" viewBox="0 0 80 80" fill="none"
      >
        <line x1="4" y1="4" x2="36" y2="36" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="44" y1="44" x2="76" y2="76" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="76" y1="4" x2="4" y2="76" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="relative z-10">
        <p className="text-[10px] font-semibold text-primary/55 uppercase tracking-[0.08em] mb-[5px]">
          Today's sync
        </p>

        <h2 className="text-[20px] font-bold tracking-[-0.02em] leading-tight mb-[3px]" style={{ color: '#FEF3C7' }}>
          {headline}
        </h2>
        <p className="text-[11px] leading-[1.4] mb-[13px] whitespace-pre-line" style={{ color: 'rgba(254,243,199,0.4)' }}>
          {subline}
        </p>

        {/* JINX reward chip — only when there's real overlap */}
        {totalJinxes > 0 && (
          <div className="inline-flex items-center gap-[6px] bg-primary/20 border border-primary/35 rounded-[9px] px-[12px] py-[6px] mr-[6px]">
            <Zap className="h-[12px] w-[12px]" strokeWidth={2.5} style={{ color: '#FCD34D' }} />
            <span className="text-[13px] font-bold" style={{ color: '#FCD34D' }}>
              {totalJinxes} JINX{totalJinxes > 1 ? 'es' : ''}
            </span>
          </div>
        )}

        {bestAnswer && bestPct !== undefined && (
          <div className="inline-flex flex-col bg-white/5 border border-white/10 rounded-[9px] px-[12px] py-[6px] mt-[6px]">
            <span className="text-[9px] uppercase tracking-[0.05em] mb-[1px]" style={{ color: 'rgba(254,243,199,0.55)' }}>
              Best hit
            </span>
            <span className="text-[13px] font-bold" style={{ color: '#FEF3C7' }}>
              {bestAnswer.toUpperCase()} · {bestPct}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
