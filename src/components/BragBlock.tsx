import { motion } from 'framer-motion';

interface Props {
  answeredCount: number;
  totalCount: number;
  vibeLabel: string;
  vibeColor: string;
  bestAnswer?: string;
  bestPct?: number;
  topPicks: number;
}

export default function BragBlock({
  answeredCount,
  totalCount,
  vibeLabel,
  vibeColor,
  bestAnswer,
  bestPct,
  topPicks,
}: Props) {
  const headline =
    answeredCount === totalCount
      ? topPicks === totalCount
        ? `You nailed all ${totalCount}`
        : `You nailed ${topPicks} of ${totalCount}`
      : `You answered ${answeredCount} of ${totalCount}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-[hsl(20_10%_11%)] text-white rounded-2xl p-6 overflow-hidden"
    >
      {/* Decorative X watermark */}
      <svg
        className="absolute top-3 right-3 w-28 h-28 opacity-[0.04]"
        viewBox="0 0 24 24"
        fill="none"
      >
        <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="4" x2="4" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="relative z-10">
        {/* Vibe label */}
        <span className={`inline-block text-[9px] font-display font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full mb-4 ${vibeColor} bg-white/10`}>
          {vibeLabel}
        </span>

        {/* Headline */}
        <h2 className="text-[28px] font-black tracking-tight leading-tight mb-1">{headline}</h2>
        <p className="text-[13px] text-white/50 mb-4">
          {topPicks === totalCount ? 'Perfect crowd read today.' : 'See how the crowd compared.'}
        </p>

        {/* Best hit pill */}
        {bestAnswer && bestPct !== undefined && (
          <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/10 rounded-full px-3.5 py-2">
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-display">Best</span>
            <span className="text-sm font-bold tracking-tight">{bestAnswer}</span>
            <span className="text-[12px] text-primary font-bold">{bestPct}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}