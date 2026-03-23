import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Zap,
  MessageSquare,
  TrendingUp,
  SlidersHorizontal,
  Archive,
  Play,
} from 'lucide-react';
import JinxLogo from '@/components/JinxLogo';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/words', label: 'Words', icon: BookOpen },
  { path: '/dashboard/daily', label: 'Daily Sets', icon: Calendar },
  { path: '/dashboard/prompts', label: 'Prompts', icon: Zap },
  { path: '/dashboard/answers', label: 'Answers', icon: MessageSquare },
  { path: '/dashboard/tuning', label: 'Tuning', icon: SlidersHorizontal },
  { path: '/dashboard/insights', label: 'Insights', icon: TrendingUp },
  { path: '/archive', label: 'Archive', icon: Archive },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background theme-dashboard">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-11 max-w-4xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <JinxLogo size={16} className="text-foreground text-sm" />
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-medium">Creator</span>
          </Link>
          <Link
            to="/play"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Play className="h-3 w-3" /> Play
          </Link>
        </div>
      </nav>

      <div className="overflow-x-auto border-b border-border/40 bg-background">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-4">{children}</main>
    </div>
  );
}
