import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gamepad2, Users, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  hasNewRoomActivity?: boolean;
  hasGroupActivity?: boolean;
  /** Total "new since last visit" count across all groups. Surfaces as numeric badge. */
  groupNewCount?: number;
}

const navItems = [
  { to: '/play', label: 'Play', icon: Gamepad2 },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/archive', label: 'Archive', icon: Archive },
];

export default function MobileBottomNav({ hasNewRoomActivity, hasGroupActivity, groupNewCount }: Props) {
  const { pathname } = useLocation();
  // Hide badge while on Groups (and force re-mount when route changes) — visiting the page resets visits per group.
  const [seenAt, setSeenAt] = useState(0);
  useEffect(() => { if (pathname.startsWith('/groups')) setSeenAt(Date.now()); }, [pathname]);

  const isActive = (to: string) => {
    if (to === '/play') return pathname === '/play' || pathname === '/';
    return pathname.startsWith(to);
  };

  return (
    <nav
      className="mobile-bottom-nav sticky bottom-0 left-0 right-0 z-50 mt-auto border-t border-foreground/[0.08] bg-background md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          const showRoomDot = to === '/archive' && hasNewRoomActivity;
          const groupCount =
            to === '/groups' && !pathname.startsWith('/groups')
              ? (groupNewCount ?? 0)
              : 0;
          const showGroupDot = to === '/groups' && hasGroupActivity && !pathname.startsWith('/groups') && groupCount === 0;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground/60'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', active && 'fill-primary/20')} strokeWidth={active ? 2.5 : 2} />
                {groupCount > 0 && (
                  <span
                    key={seenAt}
                    className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-[3px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none flex items-center justify-center"
                  >
                    {groupCount > 9 ? '9+' : groupCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] leading-none', active ? 'font-bold' : 'font-medium')}>
                {label}
              </span>
              {(showRoomDot || showGroupDot) && !active && (
                <span className="absolute top-2.5 left-1/2 translate-x-2 w-1 h-1 rounded-full bg-primary/60" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
