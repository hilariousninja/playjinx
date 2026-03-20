import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, X, Shield, FlaskConical, Loader2, RefreshCw, TrendingUp, TrendingDown, Gauge, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import JinxLogo from '@/components/JinxLogo';

type PromptStatus = 'pending' | 'approved' | 'rejected';
type PromptTag = 'safe' | 'test' | null;
type Performance = 'strong' | 'decent' | 'weak' | null;

interface PromptRow {
  id: string;
  word_a: string;
  word_b: string;
  date: string;
  active: boolean;
  mode: string;
  prompt_status: PromptStatus;
  prompt_tag: PromptTag;
  prompt_score: number;
  total_players: number;
  unique_answers: number;
  top_answer_pct: number;
  performance: Performance;
  created_at: string;
}

const STATUS_BADGE: Record<PromptStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-secondary text-secondary-foreground' },
  approved: { label: 'Approved', cls: 'bg-primary/15 text-primary' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/15 text-destructive' },
};

const TAG_BADGE: Record<string, { label: string; cls: string }> = {
  safe: { label: 'Safe', cls: 'bg-primary/10 text-primary' },
  test: { label: 'Test', cls: 'bg-accent text-accent-foreground' },
};

const PERF_BADGE: Record<string, { label: string; cls: string; icon: typeof TrendingUp }> = {
  strong: { label: 'Strong', cls: 'text-[hsl(var(--keep))]', icon: TrendingUp },
  decent: { label: 'Decent', cls: 'text-muted-foreground', icon: TrendingUp },
  weak: { label: 'Weak', cls: 'text-destructive', icon: TrendingDown },
};

// Reason badges for prompt feedback
const REASON_BADGES = [
  { key: 'healthy', label: 'Healthy clustering', cls: 'bg-[hsl(var(--keep))]/15 text-[hsl(var(--keep))]' },
  { key: 'obvious', label: 'Too obvious', cls: 'bg-[hsl(var(--review))]/15 text-[hsl(var(--review))]' },
  { key: 'abstract', label: 'Too abstract', cls: 'bg-destructive/15 text-destructive' },
  { key: 'scattered', label: 'Too scattered', cls: 'bg-destructive/15 text-destructive' },
] as const;

function getAutoReasons(p: PromptRow): string[] {
  const reasons: string[] = [];
  if (p.total_players === 0) return reasons;
  if (p.top_answer_pct >= 60) reasons.push('obvious');
  else if (p.top_answer_pct >= 35) reasons.push('healthy');
  if (p.unique_answers > 0 && p.total_players > 0) {
    const scatterRate = p.unique_answers / p.total_players;
    if (scatterRate > 0.7) reasons.push('scattered');
  }
  if (p.top_answer_pct > 0 && p.top_answer_pct < 15 && p.total_players >= 5) reasons.push('abstract');
  return reasons;
}

function ScorePill({ score }: { score: number }) {
  const cls = score >= 70 ? 'text-primary' : score >= 45 ? 'text-muted-foreground' : 'text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-display font-bold ${cls}`}>
      <Gauge className="h-3 w-3" />
      {score}
    </span>
  );
}

function ReasonBadges({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {reasons.map(r => {
        const badge = REASON_BADGES.find(b => b.key === r);
        if (!badge) return null;
        return (
          <span key={r} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

export default function PromptAdmin() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState('review');
  const [auditData, setAuditData] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false });
    setPrompts((data as PromptRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { dry_run: true },
      });
      if (!error) setAuditData(data);
    } catch (e) {
      console.error('Audit load failed', e);
    }
    setAuditLoading(false);
  }, []);

  const updatePrompt = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id);
    await supabase.from('prompts').update(updates).eq('id', id);
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as PromptRow : p));
    setUpdating(null);
  };

  const handleApprove = (id: string) => updatePrompt(id, { prompt_status: 'approved' });
  const handleReject = (id: string) => updatePrompt(id, { prompt_status: 'rejected' });
  const handleTagSafe = (id: string) => updatePrompt(id, { prompt_tag: 'safe' });
  const handleTagTest = (id: string) => updatePrompt(id, { prompt_tag: 'test' });

  const computeFeedback = async (id: string) => {
    setUpdating(id);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'compute_prompt_feedback', prompt_id: id },
    });
    if (!error && data) {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...data } as PromptRow : p));
    }
    setUpdating(null);
  };

  const pending = useMemo(() =>
    [...prompts.filter(p => p.prompt_status === 'pending')].sort((a, b) => b.prompt_score - a.prompt_score),
    [prompts]
  );
  const approved = useMemo(() =>
    [...prompts.filter(p => p.prompt_status === 'approved')].sort((a, b) => b.prompt_score - a.prompt_score),
    [prompts]
  );
  const played = useMemo(() =>
    [...prompts.filter(p => p.total_players > 0)].sort((a, b) => b.total_players - a.total_players),
    [prompts]
  );

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background theme-dashboard">
      <nav className="border-b border-border">
        <div className="container flex items-center h-14 gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <JinxLogo size={18} className="text-foreground text-base" />
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Prompt Quality</span>
        </div>
      </nav>

      <div className="container max-w-2xl py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold">{pending.length}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold">{approved.filter(p => p.prompt_tag === 'safe').length}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Safe</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold">{approved.filter(p => p.prompt_tag === 'test').length}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Test</p>
          </div>
        </div>

        {/* Quality gate guidance */}
        <div className="bg-card border border-border rounded-xl p-4 text-[10px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-xs mb-1">Quality Gate</p>
          <p>✅ Approve if: clear shared pathway, players likely to converge</p>
          <p>❌ Reject if: too abstract, vague, or likely to scatter</p>
          <p className="mt-1">Safe = high confidence · Test = uncertain, for learning</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'daily' && !auditData) loadAudit(); }}>
          <TabsList className="bg-secondary rounded-xl h-9">
            <TabsTrigger value="review" className="rounded-lg text-xs">Review ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved" className="rounded-lg text-xs">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-lg text-xs">Feedback ({played.length})</TabsTrigger>
            <TabsTrigger value="daily" className="rounded-lg text-xs"><Calendar className="h-3 w-3 mr-1" />Daily Set</TabsTrigger>
          </TabsList>

          {/* Review tab */}
          <TabsContent value="review" className="mt-4 space-y-2">
            {pending.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10">No pending prompts to review.</p>
            )}
            {pending.map((p, i) => {
              const guidance = p.prompt_score >= 70 ? { hint: 'Strong candidate → Safe', cls: 'text-primary' }
                : p.prompt_score >= 45 ? { hint: 'Worth testing → Test', cls: 'text-muted-foreground' }
                : { hint: 'Consider rejecting', cls: 'text-destructive' };
              return (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-display font-bold text-base">
                      {p.word_a} <span className="text-primary">+</span> {p.word_b}
                    </p>
                    <div className="flex items-center gap-2">
                      <ScorePill score={p.prompt_score} />
                      <Badge className={`${STATUS_BADGE[p.prompt_status].cls} text-[9px] border-0`}>
                        {STATUS_BADGE[p.prompt_status].label}
                      </Badge>
                    </div>
                  </div>
                  <p className={`text-[10px] mb-3 ${guidance.cls}`}>{guidance.hint}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => handleApprove(p.id)} disabled={updating === p.id}
                    >
                      {updating === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-xs"
                      onClick={() => handleReject(p.id)} disabled={updating === p.id}
                    >
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* Approved tab */}
          <TabsContent value="approved" className="mt-4 space-y-2">
            {approved.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10">No approved prompts yet.</p>
            )}
            {approved.map((p, i) => {
              const guidance = p.prompt_score >= 70 ? { hint: 'Strong candidate → Safe', cls: 'text-primary' }
                : p.prompt_score >= 45 ? { hint: 'Worth testing → Test', cls: 'text-muted-foreground' }
                : { hint: 'Consider rejecting', cls: 'text-destructive' };
              return (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-display font-bold text-base">
                      {p.word_a} <span className="text-primary">+</span> {p.word_b}
                    </p>
                    <div className="flex items-center gap-2">
                      <ScorePill score={p.prompt_score} />
                      {p.prompt_tag && (
                        <Badge className={`${TAG_BADGE[p.prompt_tag].cls} text-[9px] border-0`}>
                          {TAG_BADGE[p.prompt_tag].label}
                        </Badge>
                      )}
                      {p.performance && (
                        <Badge className={`${PERF_BADGE[p.performance].cls} text-[9px] border-0 bg-transparent`}>
                          {PERF_BADGE[p.performance].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!p.prompt_tag && <p className={`text-[10px] mb-2 ${guidance.cls}`}>{guidance.hint}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant={p.prompt_tag === 'safe' ? 'default' : 'outline'} className="rounded-lg text-xs"
                      onClick={() => handleTagSafe(p.id)} disabled={updating === p.id}
                    >
                      <Shield className="h-3 w-3 mr-1" /> Safe
                    </Button>
                    <Button size="sm" variant={p.prompt_tag === 'test' ? 'default' : 'outline'} className="rounded-lg text-xs"
                      onClick={() => handleTagTest(p.id)} disabled={updating === p.id}
                    >
                      <FlaskConical className="h-3 w-3 mr-1" /> Test
                    </Button>
                  </div>
                  <ReasonBadges reasons={getAutoReasons(p)} />
                </motion.div>
              );
            })}
          </TabsContent>

          {/* Feedback tab */}
          <TabsContent value="feedback" className="mt-4 space-y-2">
            {played.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10">No prompts have been played yet.</p>
            )}
            {played.map((p, i) => {
              const perf = p.performance ? PERF_BADGE[p.performance] : null;
              const reasons = getAutoReasons(p);
              return (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-display font-bold text-base">
                      {p.word_a} <span className="text-primary">+</span> {p.word_b}
                    </p>
                    <div className="flex items-center gap-2">
                      <ScorePill score={p.prompt_score} />
                      {p.prompt_tag && (
                        <Badge className={`${TAG_BADGE[p.prompt_tag].cls} text-[9px] border-0`}>
                          {TAG_BADGE[p.prompt_tag].label}
                        </Badge>
                      )}
                      {perf && (
                        <span className={`text-[10px] font-display font-bold ${perf.cls} flex items-center gap-0.5`}>
                          <perf.icon className="h-3 w-3" /> {perf.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2">
                    <span>{p.total_players} players</span>
                    <span>{p.unique_answers} unique</span>
                    <span>Top: {p.top_answer_pct}%</span>
                  </div>
                  <ReasonBadges reasons={reasons} />
                  <Button size="sm" variant="outline" className="rounded-lg text-xs mt-3"
                    onClick={() => computeFeedback(p.id)} disabled={updating === p.id}
                  >
                    {updating === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Recompute
                  </Button>
                </motion.div>
              );
            })}
          </TabsContent>

          {/* Daily Set Audit tab */}
          <TabsContent value="daily" className="mt-4 space-y-4">
            {auditLoading && (
              <div className="text-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">Analysing daily set…</p>
              </div>
            )}
            {auditData && !auditLoading && (
              <>
                {/* Current/Next trio */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {auditData.dry_run ? 'Next Selection Preview' : "Today's Active Set"}
                    </p>
                    <div className="flex items-center gap-2">
                      {auditData.editorial_confidence && (
                        <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full ${
                          auditData.editorial_confidence === 'strong'
                            ? 'bg-primary/15 text-primary'
                            : auditData.editorial_confidence === 'acceptable'
                            ? 'bg-secondary text-muted-foreground'
                            : 'bg-destructive/15 text-destructive'
                        }`}>
                          {auditData.editorial_confidence === 'strong' ? '✦ Strong' :
                           auditData.editorial_confidence === 'acceptable' ? '● Acceptable' : '⚠ Risky'}
                        </span>
                      )}
                      <span className="text-[10px] font-display font-bold text-muted-foreground">
                        {auditData.trio_quality_score}
                      </span>
                      <Button size="sm" variant="outline" className="rounded-lg text-[10px] h-7" onClick={loadAudit}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                      </Button>
                    </div>
                  </div>

                  <p className="font-display font-bold text-lg mb-3">{auditData.trio}</p>

                  {/* Individual prompt details */}
                  {auditData.prompts?.map((p: any, i: number) => (
                    <div key={i} className="border-t border-border pt-3 mt-3">
                      <div className="flex items-center justify-between">
                        <p className="font-display font-semibold text-sm">{p.pair}</p>
                        <div className="flex items-center gap-2">
                          {p.tag && <Badge className={`${TAG_BADGE[p.tag]?.cls ?? 'bg-secondary'} text-[9px] border-0`}>{p.tag}</Badge>}
                          {p.performance && (
                            <Badge className={`${PERF_BADGE[p.performance]?.cls ?? ''} text-[9px] border-0 bg-transparent`}>
                              {p.performance}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 text-[10px] text-muted-foreground mt-1">
                        {p.total_players > 0 ? (
                          <>
                            <span>{p.total_players} players</span>
                            <span>{p.unique_answers} unique</span>
                            <span>Top: {p.top_answer_pct}%</span>
                          </>
                        ) : (
                          <span className="italic">Unplayed — no history</span>
                        )}
                      </div>
                      {p.quality && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(p.quality.details as Record<string, number>).map(([key, val]) => (
                            <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              val > 0 ? 'bg-primary/10 text-primary' : val < 0 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
                            }`}>
                              {key}: {val > 0 ? '+' : ''}{val}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Score breakdown */}
                {auditData.score_breakdown && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Trio Score Breakdown</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(auditData.score_breakdown as Record<string, number>).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                          <span className={`font-display font-bold ${
                            val > 0 ? 'text-primary' : val < 0 ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                            {val > 0 ? '+' : ''}{val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Runner-ups */}
                {auditData.runner_ups?.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Runner-up Trios <span className="text-foreground/40">({auditData.candidates_sampled} sampled)</span>
                    </p>
                    {auditData.runner_ups.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-t border-border first:border-t-0">
                        <span className="text-[11px] font-display">{r.trio}</span>
                        <span className="text-[10px] font-display font-bold text-muted-foreground">{r.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!auditData && !auditLoading && (
              <div className="text-center py-10">
                <Eye className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Click to inspect today's daily set selection</p>
                <Button size="sm" variant="outline" className="mt-3 rounded-lg text-xs" onClick={loadAudit}>
                  Load Audit
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
