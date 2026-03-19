import { cn } from '@/lib/utils';

interface PromptPairProps {
  wordA: string;
  wordB: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Displays two prompt words side-by-side with a plus sign.
 * Wraps gracefully on narrow screens or with long words.
 */
export default function PromptPair({ wordA, wordB, size = 'lg', className }: PromptPairProps) {
  const sizeClasses = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-[22px] md:text-[26px]',
  };

  const plusClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('flex items-center justify-center gap-3 flex-wrap', className)}>
      <span className={cn('font-display font-bold tracking-tight text-foreground leading-none', sizeClasses[size])}>
        {wordA}
      </span>
      <span className={cn('font-display font-bold text-primary/70', plusClasses[size])}>
        +
      </span>
      <span className={cn('font-display font-bold tracking-tight text-foreground leading-none', sizeClasses[size])}>
        {wordB}
      </span>
    </div>
  );
}
