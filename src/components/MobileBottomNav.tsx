import { useState, useEffect } from 'react';
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

// On Firefox Android, `position: fixed; bottom: 0` is positioned against the
// layout viewport (full height, ignoring the URL bar). When the address bar is
// visible, the visual viewport is shorter than the layout viewport, leaving a
// blank gap beneath the nav. Pull the nav up by the difference so it always
// sits flush with the visible bottom edge.
const getVisualViewportOffset = () => {
  if (typeof window === 'undefined' || !window.visualViewport) return 0;

  const vv = window.visualViewport;
  const gap = window.innerHeight - (vv.offsetTop + vv.height);
  return gap > 1 ? Math.ceil(gap) : 0;
};

export default function MobileBottomNav({ hasNewRoomActivity, hasGroupActivity, groupNewCount }: Props) {
  const { pathname } = useLocation();
  // Hide badge while on Groups (and force re-mount when route changes) — visiting the page resets visits per group.
  const [seenAt, setSeenAt] = useState(0);
  const [visualViewportOffset, setVisualViewportOffset] = useState(0);
  useEffect(() => { if (pathname.startsWith('/groups')) setSeenAt(Date.now()); }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    let frame = 0;
    const updateGap = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setVisualViewportOffset(getVisualViewportOffset()));
    };

    updateGap();
    window.visualViewport.addEventListener('resize', updateGap);
    window.visualViewport.addEventListener('scroll', updateGap);
    window.addEventListener('resize', updateGap);
    window.addEventListener('orientationchange', updateGap);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', updateGap);
      window.visualViewport?.removeEventListener('scroll', updateGap);
      window.removeEventListener('resize', updateGap);
      window.removeEventListener('orientationchange', updateGap);
    };
  }, []);

  const isActive = (to: string) => {
    if (to === '/play') return pathname === '/play' || pathname === '/';
    return pathname.startsWith(to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-foreground/[0.08] bg-background md:hidden pb-[env(safe-area-inset-bottom)] will-change-transform"
      style={visualViewportOffset ? { transform: `translate3d(0, -${visualViewportOffset}px, 0)` } : undefined}
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
