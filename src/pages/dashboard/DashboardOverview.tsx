import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  MessageSquare,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Archive,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [dailyAudit, setDailyAudit] = useState<any>(null);
  const [wordStats, setWordStats] = useState({ total: 0, active: 0, test: 0, downweight: 0, disabled: 0, coreDeck: 0 });
  const [promptStats, setPromptStats] = useState({ played: 0, totalPlayers: 0, avgTopPct: 0 });
  const [aliasCount, setAliasCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [wordsRes, promptsRes, aliasRes, auditRes] = await Promise.all([
      supabase.from('words').select('generation_status, in_core_deck'),
      supabase.from('prompts').select('total_players, top_answer_pct').gt('total_players', 0),
      supabase.from('answer_aliases').select('id', { count: 'exact', head: true }),
      supabase.functions.invoke('generate-daily-prompts', { body: { dry_run: true } }).catch(() => ({ data: null })),
    ]);

    const words = wordsRes.data ?? [];
    setWordStats({
      total: words.length,
      active: words.filter((w: any) => w.generation_status === 'active').length,
      test: words.filter((w: any) => w.generation_status === 'test').length,
      downweight: words.filter((w: any) => w.generation_status === 'downweight').length,
      disabled: words.filter((w: any) => w.generation_status === 'disabled').length,
      coreDeck: words.filter((w: any) => w.in_core_deck).length,
    });

    const played = promptsRes.data ?? [];
    setPromptStats({
      played: played.length,
      totalPlayers: played.reduce((s: number, p: any) => s + p.total_players, 0),
      avgTopPct: played.length > 0 ? Math.round(played.reduce((s: number, p: any) => s + p.top_answer_pct, 0) / played.length) : 0,
    });

    setAliasCount(aliasRes.count ?? 0);
    setDailyAudit(auditRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRegenerate = async () => {
    if (!confirm('Force regenerate today\'s daily set? Blocked if players already answered.')) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { force_regenerate: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDailyAudit(data);
      toast.success('Daily set regenerated');
    } catch (e: any) {
      toast.error(e.message || 'Regeneration failed');
    }
    setRegenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Today's Trio */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today's trio</h2>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </Button>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-3">
          {dailyAudit ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-sm font-bold">{dailyAudit.trio}</p>
                {dailyAudit.editorial_confidence && (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-display font-bold ${
                    dailyAudit.editorial_confidence === 'strong' ? 'bg-primary/10 text-primary'
                    : dailyAudit.editorial_confidence === 'acceptable' ? 'bg-secondary text-muted-foreground'
                    : 'bg-destructive/10 text-destructive'
                  }`}>{dailyAudit.editorial_confidence}</span>
                )}
              </div>
              {dailyAudit.prompts?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between border-t border-border/30 py-1.5 first:border-t-0">
                  <span className="font-display text-xs">{p.pair}</span>
                  <span className="text-[9px] text-muted-foreground">{p.total_players > 0 ? `${p.total_players}p` : 'fresh'}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-[10px]">Could not load daily state</span>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricCard label="Word pool" value={wordStats.total} sub={`${wordStats.active} active · ${wordStats.test} test`} />
          <MetricCard label="Core deck" value={wordStats.coreDeck} sub={`${wordStats.disabled} disabled`} />
          <MetricCard label="Prompts played" value={promptStats.played} sub={`${promptStats.totalPlayers} total players`} />
          <MetricCard label="Avg consensus" value={`${promptStats.avgTopPct}%`} sub={`${aliasCount} alias rules`} />
        </div>
      </div>

      {/* Word Pool Breakdown */}
      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Generation pool</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Active', value: wordStats.active, cls: 'text-[hsl(var(--keep))]' },
            { label: 'Test', value: wordStats.test, cls: 'text-primary' },
            { label: 'Downweight', value: wordStats.downweight, cls: 'text-[hsl(var(--review))]' },
            { label: 'Disabled', value: wordStats.disabled, cls: 'text-destructive' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-border/40 bg-card p-2 text-center">
              <p className={`text-lg font-display font-bold ${item.cls}`}>{item.value}</p>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {[
            { label: 'Insights', icon: TrendingUp, path: '/dashboard/insights', desc: 'Analysis & deck curation' },
            { label: 'Answers', icon: MessageSquare, path: '/dashboard/answers', desc: 'Data hygiene' },
            { label: 'Tuning', icon: SlidersHorizontal, path: '/dashboard/tuning', desc: 'Generation controls' },
            { label: 'Archive', icon: Archive, path: '/archive', desc: 'Historical record' },
          ].map(action => (
            <Link key={action.path} to={action.path} className="group">
              <div className="rounded-lg border border-border/40 bg-card p-3 text-center transition-colors hover:border-primary/30">
                <action.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                <p className="text-[11px] font-semibold">{action.label}</p>
                <p className="text-[9px] text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-2.5">
      <p className="text-lg font-display font-bold">{value}</p>
      <p className="text-[10px] font-semibold text-foreground">{label}</p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  );
}
