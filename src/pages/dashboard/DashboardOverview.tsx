import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Zap,
  Calendar,
  MessageSquare,
  ChevronRight,
  Loader2,
  BookOpen,
  Archive,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DbWord, DbPrompt } from '@/lib/store';

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
    } catch {
      setDailyAudit(null);
    }
  }, []);

  useEffect(() => {
    loadDailyAudit();
  }, [loadDailyAudit]);

  const stats = useMemo(() => {
    if (!data) return null;

    const { words, prompts } = data;
    const today = new Date().toISOString().split('T')[0];

    const needsReview = words.filter((w) => w.status === 'unreviewed' || w.status === 'review');
    const likelyCuts = words.filter(
      (w) =>
        w.status === 'cut' ||
        ((w.weak_appearances ?? 0) >= 3 &&
          (w.strong_appearances ?? 0) < (w.weak_appearances ?? 0) &&
          w.status !== 'keep')
    );

    const candidateQueue = prompts.filter(
      (p) => p.prompt_status === 'pending' && p.total_players === 0 && p.mode !== 'archive'
    );

    const futureBank = prompts.filter(
      (p) => p.prompt_status === 'approved' && p.total_players === 0 && !p.active && p.mode !== 'archive'
    );

    const liveToday = prompts.filter((p) => p.active && p.date === today);
    const archived = prompts.filter((p) => p.total_players > 0 || p.mode === 'archive');
    const recentPlayed = prompts
      .filter((p) => p.total_players > 0)
      .sort((a, b) => b.total_players - a.total_players)
      .slice(0, 3);

    return {
      totalWords: words.length,
      keepCount: words.filter((w) => w.status === 'keep').length,
      reviewCount: needsReview.length,
      cutCount: words.filter((w) => w.status === 'cut').length,
      needsReview,
      likelyCuts,
      candidateQueue,
      futureBank,
      liveToday,
      archived,
      recentPlayed,
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
      <div className="rounded-lg border border-border/40 bg-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Control room</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <p className="text-[9px] text-muted-foreground">Today live</p>
            <p className="font-display text-lg font-bold text-foreground">{stats.liveToday.length}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">Candidates</p>
            <p className="font-display text-lg font-bold text-primary">{stats.candidateQueue.length}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">Future bank</p>
            <p className="font-display text-lg font-bold text-foreground">{stats.futureBank.length}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">Archived</p>
            <p className="font-display text-lg font-bold text-muted-foreground">{stats.archived.length}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Word bank health</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Total', value: stats.totalWords, cls: 'text-foreground' },
            { label: 'Keep', value: stats.keepCount, cls: 'text-[hsl(var(--keep))]' },
            { label: 'Review', value: stats.reviewCount, cls: 'text-[hsl(var(--review))]' },
            { label: 'Cut', value: stats.cutCount, cls: 'text-[hsl(var(--cut))]' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border/40 bg-card p-2 text-center">
              <p className={`text-lg font-display font-bold ${item.cls}`}>{item.value}</p>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {stats.needsReview.length > 0 && (
          <Link to="/dashboard/words?filter=review" className="group">
            <div className="rounded-lg border border-border/40 bg-card p-3 transition-colors hover:border-primary/30">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--review))]" />
                  <span className="text-[11px] font-semibold">Words need review</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-primary" />
              </div>
              <p className="text-xl font-display font-bold text-[hsl(var(--review))]">{stats.needsReview.length}</p>
            </div>
          </Link>
        )}

        {stats.candidateQueue.length > 0 && (
          <Link to="/dashboard/prompts?tab=review" className="group">
            <div className="rounded-lg border border-border/40 bg-card p-3 transition-colors hover:border-primary/30">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold">Candidate review queue</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-primary" />
              </div>
              <p className="text-xl font-display font-bold text-primary">{stats.candidateQueue.length}</p>
            </div>
          </Link>
        )}

        {stats.likelyCuts.length > 0 && (
          <Link to="/dashboard/words?filter=cut" className="group">
            <div className="rounded-lg border border-border/40 bg-card p-3 transition-colors hover:border-destructive/20">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-[11px] font-semibold">Likely cuts</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-destructive" />
              </div>
              <p className="text-xl font-display font-bold text-destructive">{stats.likelyCuts.length}</p>
            </div>
          </Link>
        )}

        <Link to="/dashboard/answers" className="group">
          <div className="rounded-lg border border-border/40 bg-card p-3 transition-colors hover:border-primary/30">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold">Answer hygiene</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-primary" />
            </div>
            <p className="text-xl font-display font-bold">{data?.aliasCount ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">alias rules</p>
          </div>
        </Link>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today’s trio</h2>
          <Link to="/dashboard/daily" className="text-[10px] text-primary hover:underline">
            Open Daily Sets →
          </Link>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-3">
          {dailyAudit ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-sm font-bold">{dailyAudit.trio}</p>
                {dailyAudit.editorial_confidence && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-display font-bold ${
                      dailyAudit.editorial_confidence === 'strong'
                        ? 'bg-primary/10 text-primary'
                        : dailyAudit.editorial_confidence === 'acceptable'
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {dailyAudit.editorial_confidence}
                  </span>
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
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px]">Loading daily state…</span>
            </div>
          )}
        </div>
      </div>

      {stats.recentPlayed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent learning</h2>
            <Link to="/dashboard/insights" className="text-[10px] text-primary hover:underline">
              Insights →
            </Link>
          </div>
          <div className="space-y-1">
            {stats.recentPlayed.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-3 py-2">
                <div>
                  <span className="font-display text-xs font-bold">{p.word_a}</span>
                  <span className="mx-1 text-primary">+</span>
                  <span className="font-display text-xs font-bold">{p.word_b}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground">
                  <span>{p.total_players}p</span>
                  <span>Top {p.top_answer_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow shortcuts</h2>
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
          {[
            { label: 'Words', icon: BookOpen, path: '/dashboard/words', desc: 'maintain bank' },
            { label: 'Daily Sets', icon: Calendar, path: '/dashboard/daily', desc: 'pick today 3' },
            { label: 'Prompts', icon: Zap, path: '/dashboard/prompts', desc: 'review candidates' },
            { label: 'Answers', icon: MessageSquare, path: '/dashboard/answers', desc: 'merge cleanup' },
            { label: 'Insights', icon: TrendingUp, path: '/dashboard/insights', desc: 'learn + tune' },
            { label: 'Archive', icon: Archive, path: '/archive', desc: 'read-only history' },
          ].map((action) => (
            <Link key={action.path} to={action.path} className="group">
              <div className="rounded-lg border border-border/40 bg-card p-2.5 text-center transition-colors hover:border-primary/30">
                <action.icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
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
