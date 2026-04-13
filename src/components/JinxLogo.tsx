interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 28, className = '', showWordmark = true }: Props) {
  const s = size;
  const strokeW = Math.max(2.5, s * 0.13);

  return (
    <span className={`inline-flex items-center gap-0.5 select-none ${className}`}>
      {showWordmark && (
        <span
          className="font-bold tracking-[-0.06em] text-foreground leading-none"
          style={{ fontSize: s * 0.85, fontFamily: 'var(--font-body)' }}
        >
          JIN
        </span>
      )}
      <svg
        width={s * 0.75}
        height={s * 0.75}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="inline-block"
        style={{ marginBottom: s * -0.04 }}
      >
        {/* Blue stroke: / */}
        <line
          x1="5" y1="19" x2="19" y2="5"
          stroke="hsl(var(--logo-accent))"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity="0.65"
        />
        {/* Amber stroke: \ */}
        <line
          x1="5" y1="5" x2="19" y2="19"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}