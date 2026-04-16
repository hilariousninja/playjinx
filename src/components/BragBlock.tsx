import { motion } from 'framer-motion';

interface Props {
  answeredCount: number;
  totalCount: number;
  vibeLabel: string;
  vibeColor: string;
  bestAnswer?: string;
  bestPct?: number;
  topPicks: number; // now represents JINXes count
}

export default function BragBlock({
  answeredCount,
  totalCount,
  vibeLabel,
  bestAnswer,
  bestPct,
  topPicks: jinxes,
}: Props) {
  const headline =
    answeredCount === totalCount
      ? jinxes === totalCount
        ? `${totalCount}/${totalCount} JINXed!`
        : jinxes >= 2
          ? `${jinxes} JINXes today.`
          : jinxes === 1
            ? `1 JINX today.`
            : `0 JINXes today.`
      : `You answered ${answeredCount} of ${totalCount}.`;

  const subline =
    jinxes === totalCount
      ? 'You matched the crowd on every one.'
      : jinxes >= 2
        ? 'Strong crowd instincts today.'
        : jinxes === 1
          ? 'One match — the rest went their own way.'
          : answeredCount > 0
            ? 'The crowd went a different direction.'
            : 'See how the crowd compared.';

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
        {vibeLabel && (
          <p className="text-[10px] font-semibold text-primary/55 uppercase tracking-[0.08em] mb-[5px]">
            {vibeLabel}
          </p>
        )}

        <h2 className="text-[20px] font-bold tracking-[-0.02em] leading-tight mb-[3px]" style={{ color: '#FEF3C7' }}>
          {headline}
        </h2>
        <p className="text-[11px] leading-[1.4] mb-[13px] whitespace-pre-line" style={{ color: 'rgba(254,243,199,0.4)' }}>
          {subline}
        </p>

        {bestAnswer && bestPct !== undefined && (
          <div className="inline-flex flex-col bg-primary/20 border border-primary/35 rounded-[9px] px-[14px] py-[7px]">
            <span className="text-[9px] uppercase tracking-[0.05em] mb-[2px]" style={{ color: 'rgba(253,211,77,0.6)' }}>
              Best hit
            </span>
            <span className="text-[15px] font-bold" style={{ color: '#FCD34D' }}>
              {bestAnswer.toUpperCase()} · {bestPct}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
