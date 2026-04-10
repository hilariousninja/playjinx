import { Link, useLocation } from 'react-router-dom';
import { Gamepad2, Users, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  hasNewRoomActivity?: boolean;
  hasGroupActivity?: boolean;
}

const navItems = [
  { to: '/play', label: 'Play', icon: Gamepad2 },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/archive', label: 'Archive', icon: Archive },
];

export default function MobileBottomNav({ hasNewRoomActivity, hasGroupActivity }: Props) {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === '/play') return pathname === '/play' || pathname === '/';
    return pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          const showDot =
            (to === '/archive' && hasNewRoomActivity) ||
            (to === '/groups' && hasGroupActivity && !pathname.startsWith('/groups'));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                to === '/play'
                  ? active
                    ? 'text-primary'
                    : 'text-primary/50'
                  : active
                    ? 'text-foreground'
                    : 'text-muted-foreground/60'
              )}
            >
              <Icon className={cn('h-5 w-5', to === '/play' && active && 'fill-primary/20')} strokeWidth={active ? 2.5 : 2} />
              <span className={cn('text-[10px] leading-none', active ? 'font-bold' : 'font-medium')}>
                {label}
              </span>
              {showDot && (
                <span className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
