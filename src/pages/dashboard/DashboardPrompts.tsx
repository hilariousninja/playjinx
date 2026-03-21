import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, X, Shield, FlaskConical, Loader2, RefreshCw, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

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

const TAG_BADGE: Record<string, { label: string; cls: string }> = {
  safe: { label: 'Safe', cls: 'bg-primary/10 text-primary' },
  test: { label: 'Test', cls: 'bg-accent text-accent-foreground' },
};

const PERF_BADGE: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Strong', cls: 'text-[hsl(var(--keep))]' },
  decent: { label: 'Decent', cls: 'text-muted-foreground' },
  weak: { label: 'Weak', cls: 'text-destructive' },
};

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

function ReasonBadges({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {reasons.map(r => {
        const badge = REASON_BADGES.find(b => b.key === r);
        if (!badge) return null;
        return <span key={r} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>;
      })}
    </div>
  );
}

function PromptCard({ p, onApprove, onReject, onTagSafe, onTagTest, onRecompute, updating, showActions = true, showFeedback = false }: {
  p: PromptRow;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onTagSafe?: (id: string) => void;
  onTagTest?: (id: string) => void;
  onRecompute?: (id: string) => void;
  updating: string | null;
  showActions?: boolean;
  showFeedback?: boolean;
}) {
  const reasons = getAutoReasons(p);
  const guidance = p.prompt_score >= 70 ? { hint: 'Strong candidate → Safe', cls: 'text-primary' }
    : p.prompt_score >= 45 ? { hint: 'Worth testing', cls: 'text-muted-foreground' }
    : { hint: 'Consider rejecting', cls: 'text-destructive' };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display font-bold text-base">
          {p.word_a} <span className="text-primary">+</span> {p.word_b}
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-display font-bold inline-flex items-center gap-1 ${
            p.prompt_score >= 70 ? 'text-primary' : p.prompt_score >= 45 ? 'text-muted-foreground' : 'text-destructive'
          }`}>
            <Gauge className="h-3 w-3" />{p.prompt_score}
          </span>
          {p.prompt_tag && <Badge className={`${TAG_BADGE[p.prompt_tag].cls} text-[9px] border-0`}>{TAG_BADGE[p.prompt_tag].label}</Badge>}
          {p.performance && <span className={`text-[10px] font-display font-bold ${PERF_BADGE[p.performance]?.cls}`}>{p.performance}</span>}
        </div>
      </div>

      {showFeedback && p.total_players > 0 && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2">
          <span>{p.total_players} players</span>
          <span>{p.unique_answers} unique</span>
          <span>Top: {p.top_answer_pct}%</span>
        </div>
      )}

      <ReasonBadges reasons={reasons} />

      {showActions && p.prompt_status === 'pending' && (
        <>
          <p className={`text-[10px] mb-3 mt-1 ${guidance.cls}`}>{guidance.hint}</p>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onApprove?.(p.id)} disabled={updating === p.id}>
              {updating === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />} Approve
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg text-xs"
              onClick={() => onReject?.(p.id)} disabled={updating === p.id}>
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        </>
      )}

      {showActions && p.prompt_status === 'approved' && !p.prompt_tag && (
        <>
          <p className={`text-[10px] mb-2 mt-1 ${guidance.cls}`}>{guidance.hint}</p>
          <div className="flex gap-2">
            <Button size="sm" variant={p.prompt_tag === 'safe' ? 'default' : 'outline'} className="rounded-lg text-xs"
              onClick={() => onTagSafe?.(p.id)} disabled={updating === p.id}>
              <Shield className="h-3 w-3 mr-1" /> Safe
            </Button>
            <Button size="sm" variant={p.prompt_tag === 'test' ? 'default' : 'outline'} className="rounded-lg text-xs"
              onClick={() => onTagTest?.(p.id)} disabled={updating === p.id}>
              <FlaskConical className="h-3 w-3 mr-1" /> Test
            </Button>
          </div>
        </>
      )}

      {showFeedback && onRecompute && (
        <Button size="sm" variant="outline" className="rounded-lg text-xs mt-3"
          onClick={() => onRecompute(p.id)} disabled={updating === p.id}>
          {updating === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Recompute
        </Button>
      )}
    </div>
  );
}

export default function DashboardPrompts() {
  const [searchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const initialTab = searchParams.get('tab') || 'review';
  const [tab, setTab] = useState(initialTab);

  const load = async () => {
    const { data } = await supabase.from('prompts').select('*').order('created_at', { ascending: false });
    setPrompts((data as PromptRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updatePrompt = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id);
    await supabase.from('prompts').update(updates).eq('id', id);
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as PromptRow : p));
    setUpdating(null);
  };

  const computeFeedback = async (id: string) => {
    setUpdating(id);
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'compute_prompt_feedback', prompt_id: id },
    });
    if (!error && data) setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...data } as PromptRow : p));
    setUpdating(null);
  };

  const pending = useMemo(() => prompts.filter(p => p.prompt_status === 'pending').sort((a, b) => b.prompt_score - a.prompt_score), [prompts]);
  const approved = useMemo(() => prompts.filter(p => p.prompt_status === 'approved').sort((a, b) => b.prompt_score - a.prompt_score), [prompts]);
  const played = useMemo(() => prompts.filter(p => p.total_players > 0).sort((a, b) => b.total_players - a.total_players), [prompts]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Prompts</h1>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{pending.length} pending</span>
          <span>{approved.filter(p => p.prompt_tag === 'safe').length} safe</span>
          <span>{approved.filter(p => p.prompt_tag === 'test').length} test</span>
        </div>
      </div>

      {/* Quality gate */}
      <div className="bg-card border border-border/50 rounded-xl p-3 text-[10px] text-muted-foreground">
        <p className="font-semibold text-foreground text-xs mb-1">Quality Gate</p>
        <p>✅ Approve: clear shared pathway, likely convergence · ❌ Reject: too abstract or scattered</p>
        <p className="mt-0.5">Safe = high confidence · Test = uncertain, for learning</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { key: 'review', label: `Review (${pending.length})` },
          { key: 'approved', label: `Approved (${approved.length})` },
          { key: 'feedback', label: `Feedback (${played.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tab === 'review' && (
          pending.length === 0 
            ? <p className="text-center text-xs text-muted-foreground py-10">No pending prompts.</p>
            : pending.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <PromptCard p={p} updating={updating}
                    onApprove={id => updatePrompt(id, { prompt_status: 'approved' })}
                    onReject={id => updatePrompt(id, { prompt_status: 'rejected' })}
                  />
                </motion.div>
              ))
        )}

        {tab === 'approved' && (
          approved.length === 0
            ? <p className="text-center text-xs text-muted-foreground py-10">No approved prompts yet.</p>
            : approved.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <PromptCard p={p} updating={updating}
                    onTagSafe={id => updatePrompt(id, { prompt_tag: 'safe' })}
                    onTagTest={id => updatePrompt(id, { prompt_tag: 'test' })}
                  />
                </motion.div>
              ))
        )}

        {tab === 'feedback' && (
          played.length === 0
            ? <p className="text-center text-xs text-muted-foreground py-10">No played prompts yet.</p>
            : played.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <PromptCard p={p} updating={updating} showActions={false} showFeedback onRecompute={computeFeedback} />
                </motion.div>
              ))
        )}
      </div>
    </div>
  );
}
