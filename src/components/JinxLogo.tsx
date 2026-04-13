interface Props {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export default function JinxLogo({ size = 28, className = '', showWordmark = true }: Props) {
  const s = size;
  const markSize = s * 0.85;
  const strokeW = Math.max(2.8, s * 0.13);
  const inlineStrokeW = Math.max(2.2, s * 0.1);

  return (
    <span className={`inline-flex items-center gap-[9px] select-none ${className}`}>
      {/* Mark: amber over blue with gap at crossing */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
      >
        {/* Blue stroke: broken into two segments with gap at center */}
        <line x1="2.5" y1="2.5" x2="8.8" y2="8.8" stroke="hsl(var(--logo-accent))" strokeWidth={strokeW} strokeLinecap="round" />
        <line x1="13.2" y1="13.2" x2="19.5" y2="19.5" stroke="hsl(var(--logo-accent))" strokeWidth={strokeW} strokeLinecap="round" />
        {/* Amber stroke: continuous, visually on top */}
        <line x1="19.5" y1="2.5" x2="2.5" y2="19.5" stroke="hsl(var(--primary))" strokeWidth={strokeW} strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span
          className="font-bold tracking-[0.05em] text-foreground leading-none flex items-center"
          style={{ fontSize: s * 0.58, fontFamily: 'var(--font-body)' }}
        >
          <span>JIN</span>
          {/* Inline X mark at text scale — same over-under */}
          <svg
            width={s * 0.5}
            height={s * 0.65}
            viewBox="0 0 13 17"
            fill="none"
            aria-hidden="true"
            style={{ verticalAlign: 'middle', marginBottom: 1, marginLeft: 1 }}
          >
            <line x1="1.5" y1="1.5" x2="5.2" y2="6.5" stroke="hsl(var(--logo-accent))" strokeWidth={inlineStrokeW} strokeLinecap="round" />
            <line x1="7.8" y1="10.5" x2="11.5" y2="15.5" stroke="hsl(var(--logo-accent))" strokeWidth={inlineStrokeW} strokeLinecap="round" />
            <line x1="11.5" y1="1.5" x2="1.5" y2="15.5" stroke="hsl(var(--primary))" strokeWidth={inlineStrokeW} strokeLinecap="round" />
          </svg>
        </span>
      )}
    </span>
  );
}
