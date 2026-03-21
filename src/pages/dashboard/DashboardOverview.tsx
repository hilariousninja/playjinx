import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  AlertCircle, CheckCircle, TrendingDown, TrendingUp, Zap, 
  Calendar, MessageSquare, ChevronRight, Loader2, BookOpen,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  suggestionsAvailable: boolean;
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
        suggestionsAvailable: false,
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
    const activeToday = prompts.filter(p => p.active);
    const strongPrompts = prompts.filter(p => p.performance === 'strong' && p.total_players > 0);
    const weakPrompts = prompts.filter(p => p.performance === 'weak' && p.total_players > 0);
    const playedPrompts = prompts.filter(p => p.total_players > 0).sort((a, b) => b.total_players - a.total_players);

    return {
      totalWords: words.length,
      keepCount: words.filter(w => w.status === 'keep').length,
      reviewCount: needsReview.length,
      cutCount: words.filter(w => w.status === 'cut').length,
      needsReview,
      likelyCuts,
      pendingPrompts,
      activeToday,
      strongPrompts,
      weakPrompts,
      recentPlayed: playedPrompts.slice(0, 3),
    };
  }, [data]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deck health */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Deck Health</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: stats.totalWords, cls: 'text-foreground' },
            { label: 'Keep', value: stats.keepCount, cls: 'text-[hsl(var(--keep))]' },
            { label: 'Review', value: stats.reviewCount, cls: 'text-[hsl(var(--review))]' },
            { label: 'Cut', value: stats.cutCount, cls: 'text-[hsl(var(--cut))]' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/50 rounded-xl p-3 text-center">
              <p className={`text-xl font-display font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attention needed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Words needing review */}
        {stats.needsReview.length > 0 && (
          <Link to="/dashboard/words?filter=review" className="group">
            <div className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[hsl(var(--review))]" />
                  <span className="text-xs font-semibold text-foreground">Words need review</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-2xl font-display font-bold text-[hsl(var(--review))]">{stats.needsReview.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {stats.needsReview.slice(0, 3).map(w => w.word).join(', ')}
                {stats.needsReview.length > 3 && ` +${stats.needsReview.length - 3} more`}
              </p>
            </div>
          </Link>
        )}

        {/* Pending prompts */}
        {stats.pendingPrompts.length > 0 && (
          <Link to="/dashboard/prompts?tab=review" className="group">
            <div className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Prompts to review</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-2xl font-display font-bold text-primary">{stats.pendingPrompts.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {stats.pendingPrompts.slice(0, 2).map(p => `${p.word_a}+${p.word_b}`).join(', ')}
              </p>
            </div>
          </Link>
        )}

        {/* Likely cuts */}
        {stats.likelyCuts.length > 0 && (
          <Link to="/dashboard/words?filter=cut" className="group">
            <div className="bg-card border border-border/50 rounded-xl p-4 hover:border-destructive/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold text-foreground">Likely cuts</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-destructive transition-colors" />
              </div>
              <p className="text-2xl font-display font-bold text-destructive">{stats.likelyCuts.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Weak words flagged for removal</p>
            </div>
          </Link>
        )}

        {/* Answer cleanup */}
        <Link to="/dashboard/answers" className="group">
          <div className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Answer cleanup</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-2xl font-display font-bold">{data?.aliasCount ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">aliases configured</p>
          </div>
        </Link>
      </div>

      {/* Today's daily set */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Daily Set</h2>
          <Link to="/dashboard/daily" className="text-[10px] text-primary hover:underline">Manage →</Link>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4">
          {dailyAudit ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-display font-bold text-base">{dailyAudit.trio}</p>
                <div className="flex items-center gap-2">
                  {dailyAudit.editorial_confidence && (
                    <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full ${
                      dailyAudit.editorial_confidence === 'strong'
                        ? 'bg-primary/15 text-primary'
                        : dailyAudit.editorial_confidence === 'acceptable'
                        ? 'bg-secondary text-muted-foreground'
                        : 'bg-destructive/15 text-destructive'
                    }`}>
                      {dailyAudit.editorial_confidence === 'strong' ? '✦ Strong' :
                       dailyAudit.editorial_confidence === 'acceptable' ? '● Acceptable' : '⚠ Risky'}
                    </span>
                  )}
                  <span className="text-[10px] font-display font-bold text-muted-foreground">
                    {dailyAudit.trio_quality_score}
                  </span>
                </div>
              </div>
              {dailyAudit.prompts?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-t border-border/30 first:border-t-0">
                  <span className="font-display text-sm">{p.pair}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {p.tag && <span className="text-primary">{p.tag}</span>}
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Loading daily set…</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent play insights */}
      {stats.recentPlayed.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Play Data</h2>
            <Link to="/dashboard/insights" className="text-[10px] text-primary hover:underline">All insights →</Link>
          </div>
          <div className="space-y-1.5">
            {stats.recentPlayed.map(p => (
              <div key={p.id} className="bg-card border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-display text-sm font-bold">{p.word_a}</span>
                  <span className="text-primary mx-1.5">+</span>
                  <span className="font-display text-sm font-bold">{p.word_b}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{p.total_players} players</span>
                  <span>Top: {p.top_answer_pct}%</span>
                  {p.performance && (
                    <span className={`font-display font-bold ${
                      p.performance === 'strong' ? 'text-[hsl(var(--keep))]' : 
                      p.performance === 'weak' ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {p.performance}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'Review words', icon: BookOpen, path: '/dashboard/words', desc: `${stats.reviewCount} pending` },
            { label: 'Review prompts', icon: Zap, path: '/dashboard/prompts', desc: `${stats.pendingPrompts.length} pending` },
            { label: 'Daily sets', icon: Calendar, path: '/dashboard/daily', desc: 'Build & approve' },
            { label: 'Answer cleanup', icon: MessageSquare, path: '/dashboard/answers', desc: 'Aliases & merges' },
            { label: 'Play insights', icon: TrendingUp, path: '/dashboard/insights', desc: 'Learn from data' },
          ].map(action => (
            <Link key={action.path} to={action.path} className="group">
              <div className="bg-card border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-colors">
                <action.icon className="h-4 w-4 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                <p className="text-xs font-semibold">{action.label}</p>
                <p className="text-[10px] text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
