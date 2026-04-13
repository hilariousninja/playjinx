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
      className="relative bg-[hsl(20_10%_12%)] text-white rounded-2xl p-5 overflow-hidden"
    >
      {/* Decorative X watermark */}
      <svg
        className="absolute top-2 right-2 w-24 h-24 opacity-[0.04]"
        viewBox="0 0 24 24"
        fill="none"
      >
        <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="4" x2="4" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="relative z-10">
        {/* Vibe label */}
        <span className={`inline-block text-[10px] font-display font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3 ${vibeColor} bg-white/10`}>
          {vibeLabel}
        </span>

        {/* Headline */}
        <h2 className="text-2xl font-bold mb-1">{headline}</h2>
        <p className="text-[13px] text-white/60 mb-3">
          {topPicks === totalCount ? 'Perfect crowd read today.' : 'See how the crowd compared.'}
        </p>

        {/* Best hit pill */}
        {bestAnswer && bestPct !== undefined && (
          <div className="inline-flex items-center gap-2 bg-primary/20 rounded-full px-3 py-1.5">
            <span className="text-[10px] text-white/60 uppercase tracking-wider font-display">Best hit</span>
            <span className="text-sm font-bold">{bestAnswer}</span>
            <span className="text-[11px] text-primary font-bold">{bestPct}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
