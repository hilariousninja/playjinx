interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 24, className = '', showWordmark = true }: Props) {
  const s = size;
  const strokeW = Math.max(2, s * 0.12);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {showWordmark && (
        <span className="font-display font-bold tracking-tighter text-foreground">
          JIN
        </span>
      )}
      <svg
        width={s * 0.7}
        height={s * 0.7}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="inline-block"
      >
        {/* Blue stroke: / */}
        <line
          x1="6" y1="18" x2="18" y2="6"
          stroke="hsl(var(--logo-accent))"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Amber stroke: \ */}
        <line
          x1="6" y1="6" x2="18" y2="18"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
