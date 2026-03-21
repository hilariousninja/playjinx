import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Zap, Calendar, MessageSquare, 
  TrendingUp, Play, ChevronRight
} from 'lucide-react';
import JinxLogo from '@/components/JinxLogo';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/words', label: 'Words', icon: BookOpen },
  { path: '/dashboard/prompts', label: 'Prompts', icon: Zap },
  { path: '/dashboard/daily', label: 'Daily Sets', icon: Calendar },
  { path: '/dashboard/answers', label: 'Answers', icon: MessageSquare },
  { path: '/dashboard/insights', label: 'Insights', icon: TrendingUp },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background theme-dashboard">
      {/* Top nav */}
      <nav className="border-b border-border/60 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between h-11 px-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5">
            <Link to="/dashboard" className="flex items-center gap-2">
              <JinxLogo size={16} className="text-foreground text-sm" />
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.2em] font-medium">Creator</span>
            </Link>
          </div>
          <Link 
            to="/play" 
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Play className="h-3 w-3" /> Play
          </Link>
        </div>
      </nav>

      {/* Section nav */}
      <div className="border-b border-border/40 overflow-x-auto bg-background">
        <div className="flex items-center gap-0.5 px-3 h-9 max-w-4xl mx-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
