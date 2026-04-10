import { Link, useLocation } from 'react-router-dom';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import { cn } from '@/lib/utils';

interface Props {
  hasNewRoomActivity?: boolean;
  hasGroupActivity?: boolean;
}

const navItems = [
  { to: '/play', label: 'Play' },
  { to: '/groups', label: 'Groups' },
  { to: '/archive', label: 'Archive' },
];

export default function AppHeader({ hasNewRoomActivity, hasGroupActivity }: Props) {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === '/play') return pathname === '/play' || pathname === '/';
    return pathname.startsWith(to);
  };

  return (
    <header className="border-b border-border shrink-0">
      <div className="flex items-center justify-between h-14 max-w-xl mx-auto px-5">
        <Link to="/">
          <JinxLogo size={22} className="text-foreground text-lg" />
        </Link>
        {/* Desktop nav — hidden on mobile (bottom nav used instead) */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
                to === '/play'
                  ? isActive(to)
                    ? 'text-primary-foreground bg-primary shadow-sm'
                    : 'text-primary hover:bg-primary/10'
                  : isActive(to)
                    ? 'text-foreground bg-muted font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {label}
              {to === '/archive' && hasNewRoomActivity && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {to === '/groups' && hasGroupActivity && !isActive(to) && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center">
          <PlayerIdentity />
        </div>
      </div>
    </header>
  );
}
