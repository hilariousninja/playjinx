interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 24, className = '', showWordmark = true }: Props) {
  const dotR = size * 0.09;
  const mid = size / 2;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* Convergence icon: two dots converging to one */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
        <circle cx={mid - size * 0.22} cy={mid - size * 0.2} r={dotR} fill="currentColor" opacity="0.45" />
        <circle cx={mid + size * 0.22} cy={mid - size * 0.2} r={dotR} fill="currentColor" opacity="0.45" />
        {/* Convergence lines */}
        <line x1={mid - size * 0.22} y1={mid - size * 0.2 + dotR} x2={mid} y2={mid + size * 0.18 - dotR} stroke="currentColor" strokeWidth={size * 0.04} opacity="0.2" />
        <line x1={mid + size * 0.22} y1={mid - size * 0.2 + dotR} x2={mid} y2={mid + size * 0.18 - dotR} stroke="currentColor" strokeWidth={size * 0.04} opacity="0.2" />
        {/* Meeting point */}
        <circle cx={mid} cy={mid + size * 0.18} r={dotR * 1.3} className="fill-primary" />
      </svg>
      {showWordmark && (
        <span className="font-display font-bold tracking-tighter text-foreground">JINX</span>
      )}
    </span>
  );
}
