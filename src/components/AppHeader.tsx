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
    <header className="border-b border-border/60 shrink-0 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between h-14 max-w-xl mx-auto px-5">
        <Link to="/" className="shrink-0">
          <JinxLogo size={26} className="text-foreground" />
        </Link>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-[13px] font-semibold px-3.5 py-1.5 rounded-lg transition-colors',
                isActive(to)
                  ? 'text-primary-foreground bg-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              )}
            >
              {label}
              {to === '/archive' && hasNewRoomActivity && !isActive(to) && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {to === '/groups' && hasGroupActivity && !isActive(to) && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center shrink-0">
          <PlayerIdentity />
        </div>
      </div>
    </header>
  );
}