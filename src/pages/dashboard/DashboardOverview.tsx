import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, CheckCircle, TrendingDown, TrendingUp, Zap, 
  Calendar, MessageSquare, ChevronRight, Loader2, BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DbWord, DbPrompt } from '@/lib/store';

type ConfidenceLevel = 'low' | 'medium' | 'high';

function getConfidence(word: DbWord): ConfidenceLevel {
  const totalAppearances = (word.strong_appearances ?? 0) + (word.weak_appearances ?? 0);
  if (totalAppearances < 2) return 'low';
  const strongRate = totalAppearances > 0 ? (word.strong_appearances ?? 0) / totalAppearances : 0;
  if (totalAppearances >= 5 && (strongRate >= 0.7 || strongRate <= 0.3)) return 'high';
  return 'medium';
}

interface OverviewData {
  words: DbWord[];
  prompts: DbPrompt[];
  aliasCount: number;
}

export default function DashboardOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyAudit, setDailyAudit] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [wordsRes, promptsRes, aliasRes] = await Promise.all([
        supabase.from('words').select('*').order('word'),
        supabase.from('prompts').select('*').order('created_at', { ascending: false }),
        supabase.from('answer_aliases').select('id', { count: 'exact', head: true }),
      ]);
      setData({
        words: (wordsRes.data ?? []) as DbWord[],
        prompts: (promptsRes.data ?? []) as DbPrompt[],
        aliasCount: aliasRes.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const loadDailyAudit = useCallback(async () => {
    try {
      const { data: auditData } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { dry_run: true },
      });
      setDailyAudit(auditData);
    } catch {}
  }, []);

  useEffect(() => { loadDailyAudit(); }, [loadDailyAudit]);

  const stats = useMemo(() => {
    if (!data) return null;
    const { words, prompts } = data;
    const needsReview = words.filter(w => w.status === 'unreviewed' || w.status === 'review');
    const likelyCuts = words.filter(w => 
      w.status === 'cut' || ((w.weak_appearances ?? 0) >= 3 && (w.strong_appearances ?? 0) < (w.weak_appearances ?? 0) && w.status !== 'keep')
    );
    const pendingPrompts = prompts.filter(p => p.prompt_status === 'pending');
    const playedPrompts = prompts.filter(p => p.total_players > 0).sort((a, b) => b.total_players - a.total_players);
    return {
      totalWords: words.length,
      keepCount: words.filter(w => w.status === 'keep').length,
      reviewCount: needsReview.length,
      cutCount: words.filter(w => w.status === 'cut').length,
      needsReview,
      likelyCuts,
      pendingPrompts,
      recentPlayed: playedPrompts.slice(0, 3),
    };
  }, [data]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deck health — compact row */}
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deck</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Total', value: stats.totalWords, cls: 'text-foreground' },
            { label: 'Keep', value: stats.keepCount, cls: 'text-[hsl(var(--keep))]' },
            { label: 'Review', value: stats.reviewCount, cls: 'text-[hsl(var(--review))]' },
            { label: 'Cut', value: stats.cutCount, cls: 'text-[hsl(var(--cut))]' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/40 rounded-lg p-2 text-center">
              <p className={`text-lg font-display font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attention cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {stats.needsReview.length > 0 && (
          <Link to="/dashboard/words?filter=review" className="group">
            <div className="bg-card border border-border/40 rounded-lg p-3 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--review))]" />
                  <span className="text-[11px] font-semibold">Words need review</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xl font-display font-bold text-[hsl(var(--review))]">{stats.needsReview.length}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                {stats.needsReview.slice(0, 3).map(w => w.word).join(', ')}
                {stats.needsReview.length > 3 && ` +${stats.needsReview.length - 3}`}
              </p>
            </div>
          </Link>
        )}

        {stats.pendingPrompts.length > 0 && (
          <Link to="/dashboard/prompts?tab=review" className="group">
            <div className="bg-card border border-border/40 rounded-lg p-3 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold">Prompts to review</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xl font-display font-bold text-primary">{stats.pendingPrompts.length}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {stats.pendingPrompts.slice(0, 2).map(p => `${p.word_a}+${p.word_b}`).join(', ')}
              </p>
            </div>
          </Link>
        )}

        {stats.likelyCuts.length > 0 && (
          <Link to="/dashboard/words?filter=cut" className="group">
            <div className="bg-card border border-border/40 rounded-lg p-3 hover:border-destructive/20 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-[11px] font-semibold">Likely cuts</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-destructive transition-colors" />
              </div>
              <p className="text-xl font-display font-bold text-destructive">{stats.likelyCuts.length}</p>
            </div>
          </Link>
        )}

        <Link to="/dashboard/answers" className="group">
          <div className="bg-card border border-border/40 rounded-lg p-3 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold">Answer cleanup</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xl font-display font-bold">{data?.aliasCount ?? 0}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">aliases configured</p>
          </div>
        </Link>
      </div>

      {/* Today's set */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today</h2>
          <Link to="/dashboard/daily" className="text-[10px] text-primary hover:underline">Manage →</Link>
        </div>
        <div className="bg-card border border-border/40 rounded-lg p-3">
          {dailyAudit ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-display font-bold text-sm">{dailyAudit.trio}</p>
                <div className="flex items-center gap-2">
                  {dailyAudit.editorial_confidence && (
                    <span className={`text-[9px] font-display font-bold px-2 py-0.5 rounded-full ${
                      dailyAudit.editorial_confidence === 'strong'
                        ? 'bg-primary/10 text-primary'
                        : dailyAudit.editorial_confidence === 'acceptable'
                        ? 'bg-secondary text-muted-foreground'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {dailyAudit.editorial_confidence === 'strong' ? '✦ Strong' :
                       dailyAudit.editorial_confidence === 'acceptable' ? '● Acceptable' : '⚠ Risky'}
                    </span>
                  )}
                </div>
              </div>
              {dailyAudit.prompts?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-t border-border/30 first:border-t-0">
                  <span className="font-display text-xs">{p.pair}</span>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    {p.performance && (
                      <span className={p.performance === 'strong' ? 'text-[hsl(var(--keep))]' : p.performance === 'weak' ? 'text-destructive' : ''}>
                        {p.performance}
                      </span>
                    )}
                    {p.total_players > 0 && <span>{p.total_players}p</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px]">Loading…</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent play */}
      {stats.recentPlayed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Play</h2>
            <Link to="/dashboard/insights" className="text-[10px] text-primary hover:underline">All insights →</Link>
          </div>
          <div className="space-y-1">
            {stats.recentPlayed.map(p => (
              <div key={p.id} className="bg-card border border-border/40 rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-display text-xs font-bold">{p.word_a}</span>
                  <span className="text-primary mx-1">+</span>
                  <span className="font-display text-xs font-bold">{p.word_b}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground">
                  <span>{p.total_players}p</span>
                  <span>Top {p.top_answer_pct}%</span>
                  {p.performance && (
                    <span className={`font-display font-bold ${
                      p.performance === 'strong' ? 'text-[hsl(var(--keep))]' : 
                      p.performance === 'weak' ? 'text-destructive' : ''
                    }`}>{p.performance}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
          {[
            { label: 'Words', icon: BookOpen, path: '/dashboard/words', desc: `${stats.reviewCount} pending` },
            { label: 'Prompts', icon: Zap, path: '/dashboard/prompts', desc: `${stats.pendingPrompts.length} pending` },
            { label: 'Daily Sets', icon: Calendar, path: '/dashboard/daily', desc: 'Build & approve' },
            { label: 'Answers', icon: MessageSquare, path: '/dashboard/answers', desc: 'Cleanup' },
            { label: 'Insights', icon: TrendingUp, path: '/dashboard/insights', desc: 'Play data' },
          ].map(action => (
            <Link key={action.path} to={action.path} className="group">
              <div className="bg-card border border-border/40 rounded-lg p-2.5 hover:border-primary/30 transition-colors text-center">
                <action.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-[10px] font-semibold">{action.label}</p>
                <p className="text-[8px] text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
