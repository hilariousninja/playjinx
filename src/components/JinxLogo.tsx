interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 32, className = '', showWordmark = true }: Props) {
  const s = size;
  const markSize = s * 0.9;
  const strokeW = Math.max(3, s * 0.14);

  return (
    <span className={`inline-flex items-center gap-[7px] select-none ${className}`}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
      >
        <line x1="2.5" y1="2.5" x2="8.5" y2="8.5" stroke="hsl(var(--logo-accent))" strokeWidth={strokeW} strokeLinecap="round" />
        <line x1="13.5" y1="13.5" x2="19.5" y2="19.5" stroke="hsl(var(--logo-accent))" strokeWidth={strokeW} strokeLinecap="round" />
        <line x1="19.5" y1="2.5" x2="2.5" y2="19.5" stroke="hsl(var(--primary))" strokeWidth={strokeW} strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span
          className="font-extrabold tracking-[0.04em] text-foreground leading-none"
          style={{ fontSize: s * 0.62 }}
        >
          JINX
        </span>
      )}
    </span>
  );
}
