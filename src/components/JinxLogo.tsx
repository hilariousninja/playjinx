interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 24, className = '', showWordmark = true }: Props) {
  const w = size;
  const h = size * 0.6;
  const r = size * 0.12;
  const cy = h / 2;
  const cx1 = size * 0.22;
  const cx2 = size * 0.78;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
        {/* Left circle */}
        <circle cx={cx1} cy={cy} r={r} className="fill-primary" />
        {/* Right circle */}
        <circle cx={cx2} cy={cy} r={r} className="fill-primary" />
        {/* Connecting line */}
        <line
          x1={cx1 + r}
          y1={cy}
          x2={cx2 - r}
          y2={cy}
          stroke="currentColor"
          strokeWidth={size * 0.06}
          opacity="0.25"
          strokeLinecap="round"
        />
        {/* Center meeting dot */}
        <circle cx={w / 2} cy={cy} r={r * 0.5} className="fill-primary" opacity="0.5" />
      </svg>
      {showWordmark && (
        <span className="font-display font-bold tracking-tighter text-foreground">JINX</span>
      )}
    </span>
  );
}
