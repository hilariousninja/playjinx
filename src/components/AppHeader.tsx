import { Link, useLocation } from 'react-router-dom';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import { cn } from '@/lib/utils';

interface Props {
  hasNewRoomActivity?: boolean;
}

const navItems = [
  { to: '/play', label: 'Play' },
  { to: '/groups', label: 'Groups' },
  { to: '/archive', label: 'Archive' },
];

export default function AppHeader({ hasNewRoomActivity }: Props) {
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
        <div className="flex items-center gap-1">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
                isActive(to)
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {to === '/archive' && hasNewRoomActivity && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          ))}
          <div className="ml-2">
            <PlayerIdentity />
          </div>
        </div>
      </div>
    </header>
  );
}
