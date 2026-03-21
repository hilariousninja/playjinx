import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Shield, FlaskConical, Loader2, RefreshCw, Gauge,
  Sparkles, Plus, ChevronDown, ChevronUp, AlertTriangle, Lightbulb,
  Search, ArrowUpDown, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ───
type PromptStatus = 'pending' | 'approved' | 'rejected';
type PromptTag = 'safe' | 'test' | null;
type Performance = 'strong' | 'decent' | 'weak' | null;
type Recommendation = 'safe' | 'test' | 'risky' | 'reject';

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

interface EvalCandidate {
  pair: string;
  word_a: string;
  word_b: string;
  word_a_category: string;
  word_b_category: string;
  word_a_jinx_score: number;
  word_b_jinx_score: number;
  word_a_times_used: number;
  word_b_times_used: number;
  predicted_top_5: string[];
  consensus_strength: number;
  fragmentation_risk: number;
  fast_comprehension: number;
  reveal_satisfaction: number;
  naturalness: number;
  total_score: number;
  why_jinxable: string;
  why_might_fail: string;
  recommendation: Recommendation;
}

interface SuggestedWord {
  word: string;
  category: string;
  reason: string;
  strong_pairs: string[];
  fills_gap: string;
  confidence: number;
}

// ─── Constants ───
const REC_STYLES: Record<Recommendation, { label: string; cls: string }> = {
  safe: { label: 'Safe', cls: 'bg-[hsl(var(--keep))]/15 text-[hsl(var(--keep))]' },
  test: { label: 'Test', cls: 'bg-primary/15 text-primary' },
  risky: { label: 'Risky', cls: 'bg-[hsl(var(--review))]/15 text-[hsl(var(--review))]' },
  reject: { label: 'Reject', cls: 'bg-destructive/15 text-destructive' },
};

const SCORE_DIMS = [
  { key: 'consensus_strength', label: 'Convergence', max: 30 },
  { key: 'fast_comprehension', label: 'Comprehension', max: 20 },
  { key: 'reveal_satisfaction', label: 'Reveal', max: 20 },
  { key: 'naturalness', label: 'Naturalness', max: 10 },
] as const;

// ─── Score bar component ───
function ScoreBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 70 ? 'bg-[hsl(var(--keep))]' : pct >= 45 ? 'bg-primary' : 'bg-destructive';
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-display font-bold">{value}/{max}</span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Candidate card ───
function CandidateCard({ c, onAccept, onReject, accepting }: {
  c: EvalCandidate;
  onAccept: (c: EvalCandidate) => void;
  onReject: (c: EvalCandidate) => void;
  accepting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rec = REC_STYLES[c.recommendation];
  const scoreColor = c.total_score >= 70 ? 'text-[hsl(var(--keep))]' : c.total_score >= 45 ? 'text-primary' : 'text-destructive';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-lg overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <p className="font-display font-bold text-base tracking-tight">
            {c.word_a} <span className="text-primary">+</span> {c.word_b}
          </p>
          <div className="flex items-center gap-2">
            <span className={`font-display font-bold text-sm ${scoreColor}`}>{c.total_score}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${rec.cls}`}>{rec.label}</span>
          </div>
        </div>

        {/* Word metadata */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
          <span className="bg-secondary/50 px-1.5 py-0.5 rounded">{c.word_a_category}</span>
          <span className="bg-secondary/50 px-1.5 py-0.5 rounded">{c.word_b_category}</span>
          {c.word_a_times_used > 0 && <span className="opacity-60">{c.word_a.toLowerCase()} used {c.word_a_times_used}×</span>}
          {c.word_b_times_used > 0 && <span className="opacity-60">{c.word_b.toLowerCase()} used {c.word_b_times_used}×</span>}
        </div>

        {/* Predicted answers */}
        <div className="mb-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Predicted top answers</p>
          <div className="flex flex-wrap gap-1.5">
            {c.predicted_top_5.map((a, i) => (
              <span
                key={a}
                className={`font-display text-[11px] px-2 py-0.5 rounded-lg border ${
                  i === 0 ? 'border-primary/30 bg-primary/10 text-primary font-semibold' : 'border-border/30 bg-secondary/30'
                }`}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Score dimensions */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
          {SCORE_DIMS.map(d => (
            <ScoreBar key={d.key} value={(c as any)[d.key]} max={d.max} label={d.label} />
          ))}
          <ScoreBar value={Math.max(0, 20 - Math.round(c.fragmentation_risk / 5))} max={20} label="Spread control" />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Less detail' : 'Why this pair?'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 text-[11px] mb-3 pb-3 border-b border-border/30">
                <div>
                  <span className="text-[hsl(var(--keep))] font-semibold">✓ JINXable: </span>
                  <span className="text-muted-foreground">{c.why_jinxable}</span>
                </div>
                <div>
                  <span className="text-destructive font-semibold">⚠ Risk: </span>
                  <span className="text-muted-foreground">{c.why_might_fail}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="rounded-lg text-xs flex-1"
            onClick={() => onAccept(c)}
            disabled={accepting}
          >
            {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
            Accept as {c.recommendation === 'safe' ? 'Safe' : 'Test'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg text-xs"
            onClick={() => onReject(c)}
            disabled={accepting}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Suggested word card ───
function SuggestedWordCard({ w, onAdd, adding }: {
  w: SuggestedWord;
  onAdd: (w: SuggestedWord) => void;
  adding: boolean;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display font-bold text-sm">{w.word.toUpperCase()}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{w.category}</span>
          <span className={`font-display font-bold text-[10px] ${w.confidence >= 75 ? 'text-[hsl(var(--keep))]' : w.confidence >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
            {w.confidence}%
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{w.reason}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {w.strong_pairs.slice(0, 3).map(p => (
          <span key={p} className="text-[9px] font-display bg-secondary/30 px-1.5 py-0.5 rounded">{p}</span>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground/70 mb-2">Gap: {w.fills_gap}</p>
      <Button size="sm" variant="outline" className="rounded-lg text-xs w-full" onClick={() => onAdd(w)} disabled={adding}>
        {adding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
        Add to word bank
      </Button>
    </div>
  );
}

// ─── Existing prompt card (simplified) ───
function ExistingPromptCard({ p, onApprove, onReject, onTagSafe, onTagTest, updating }: {
  p: PromptRow;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onTagSafe?: (id: string) => void;
  onTagTest?: (id: string) => void;
  updating: string | null;
}) {
  const scoreColor = p.prompt_score >= 70 ? 'text-[hsl(var(--keep))]' : p.prompt_score >= 45 ? 'text-primary' : 'text-destructive';

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display font-bold text-sm">
          {p.word_a} <span className="text-primary">+</span> {p.word_b}
        </p>
        <div className="flex items-center gap-2">
          <span className={`font-display font-bold text-[10px] inline-flex items-center gap-0.5 ${scoreColor}`}>
            <Gauge className="h-3 w-3" />{p.prompt_score}
          </span>
          {p.prompt_tag && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              p.prompt_tag === 'safe' ? 'bg-[hsl(var(--keep))]/15 text-[hsl(var(--keep))]' : 'bg-primary/15 text-primary'
            }`}>
              {p.prompt_tag === 'safe' ? 'Safe' : 'Test'}
            </span>
          )}
          {p.performance && (
            <span className={`text-[10px] font-display font-bold ${
              p.performance === 'strong' ? 'text-[hsl(var(--keep))]' : p.performance === 'weak' ? 'text-destructive' : 'text-muted-foreground'
            }`}>{p.performance}</span>
          )}
        </div>
      </div>

      {/* Lifecycle label */}
      <div className="flex items-center gap-2 mb-2">
        {p.total_players > 0 ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">⚠ Historical — {p.total_players} players</span>
        ) : p.mode === 'archive' ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">Archived</span>
        ) : p.active ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Live</span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Future bank</span>
        )}
        {p.total_players > 0 && (
          <span className="text-[10px] text-muted-foreground">{p.unique_answers} unique · Top: {p.top_answer_pct}%</span>
        )}
      </div>

      {p.prompt_status === 'pending' && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="rounded-lg text-xs" onClick={() => onApprove?.(p.id)} disabled={updating === p.id}>
            {updating === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />} Approve
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => onReject?.(p.id)} disabled={updating === p.id}>
            <X className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      )}

      {p.prompt_status === 'approved' && !p.prompt_tag && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => onTagSafe?.(p.id)} disabled={updating === p.id}>
            <Shield className="h-3 w-3 mr-1" /> Safe
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => onTagTest?.(p.id)} disabled={updating === p.id}>
            <FlaskConical className="h-3 w-3 mr-1" /> Test
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───
export default function DashboardPrompts() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'discover';
  const [tab, setTab] = useState(initialTab);

  // Existing prompts
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // AI evaluation
  const [candidates, setCandidates] = useState<EvalCandidate[]>([]);
  const [suggestedWords, setSuggestedWords] = useState<SuggestedWord[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Filters
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('prompts').select('*').order('created_at', { ascending: false });
      setPrompts((data as PromptRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const updatePrompt = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id);
    await supabase.from('prompts').update(updates).eq('id', id);
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } as PromptRow : p));
    setUpdating(null);
  };

  // AI generate candidates
  const generateCandidates = useCallback(async () => {
    setEvaluating(true);
    setDismissed(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-prompts', {
        body: { action: 'generate_candidates', count: 12 },
      });
      if (error) throw error;
      setCandidates(data.candidates ?? []);
      setSuggestedWords(data.suggested_words ?? []);
      toast.success(`Evaluated ${data.total_evaluated ?? 0} pairs, found ${(data.candidates ?? []).length} candidates`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate candidates');
    }
    setEvaluating(false);
  }, []);

  const acceptCandidate = async (c: EvalCandidate) => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-prompts', {
        body: {
          action: 'accept_candidate',
          word_a: c.word_a,
          word_b: c.word_b,
          recommendation: c.recommendation,
          total_score: c.total_score,
        },
      });
      if (error) throw error;
      toast.success(`${c.word_a} + ${c.word_b} added as ${c.recommendation}`);
      setDismissed(prev => new Set([...prev, c.pair]));
      // Add to local prompts list
      if (data.prompt) setPrompts(prev => [data.prompt as PromptRow, ...prev]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept candidate');
    }
    setAccepting(false);
  };

  const dismissCandidate = (c: EvalCandidate) => {
    setDismissed(prev => new Set([...prev, c.pair]));
  };

  const addSuggestedWord = async (w: SuggestedWord) => {
    setAddingWord(true);
    try {
      const { error } = await supabase.functions.invoke('evaluate-prompts', {
        body: { action: 'add_suggested_word', word: w.word, category: w.category, reason: w.reason },
      });
      if (error) throw error;
      toast.success(`${w.word.toUpperCase()} added to word bank`);
      setSuggestedWords(prev => prev.filter(sw => sw.word !== w.word));
    } catch (err: any) {
      toast.error(err.message || 'Failed to add word');
    }
    setAddingWord(false);
  };

  const visibleCandidates = candidates.filter(c => !dismissed.has(c.pair));

  const candidateQueue = useMemo(
    () =>
      prompts
        .filter(p => p.prompt_status === 'pending' && p.total_players === 0 && p.mode !== 'archive')
        .sort((a, b) => b.prompt_score - a.prompt_score),
    [prompts]
  );

  const futureBank = useMemo(() => {
    const list = prompts.filter(
      p => p.prompt_status === 'approved' && p.total_players === 0 && !p.active && p.mode !== 'archive'
    );
    return sortBy === 'score' ? list.sort((a, b) => b.prompt_score - a.prompt_score) : list;
  }, [prompts, sortBy]);

  const playedLearning = useMemo(
    () => prompts.filter(p => p.total_players > 0).sort((a, b) => b.total_players - a.total_players),
    [prompts]
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const tabs = [
    { key: 'discover', label: 'Generate', icon: Sparkles },
    { key: 'review', label: `Candidates (${candidateQueue.length})`, icon: Eye },
    { key: 'approved', label: `Future Bank (${futureBank.length})`, icon: Shield },
    { key: 'feedback', label: `Learn (${playedLearning.length})`, icon: Gauge },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold">Prompt candidates</h1>
          <p className="text-[10px] text-muted-foreground">Generate from words → review → move strong pairs into future bank.</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{candidateQueue.length} to review</span>
          <span>{futureBank.filter(p => p.prompt_tag === 'safe').length} safe-tagged</span>
          <span>{futureBank.filter(p => p.prompt_tag === 'test').length} test-tagged</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Discover tab ─── */}
      {tab === 'discover' && (
        <div className="space-y-4">
          {/* Generate button */}
          <div className="bg-card border border-border/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold">AI Pair Discovery</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Generate and evaluate JINXable pairs from your word database
                </p>
              </div>
              <Button
                size="sm"
                className="rounded-lg text-xs"
                onClick={generateCandidates}
                disabled={evaluating}
              >
                {evaluating ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Evaluating…</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> Generate candidates</>
                )}
              </Button>
            </div>
            {evaluating && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Simulating answers and scoring JINXability…
              </div>
            )}
          </div>

          {/* Candidates */}
          {visibleCandidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {visibleCandidates.length} candidates ranked by JINXability
              </p>
              {visibleCandidates.map(c => (
                <CandidateCard
                  key={c.pair}
                  c={c}
                  onAccept={acceptCandidate}
                  onReject={dismissCandidate}
                  accepting={accepting}
                />
              ))}
            </div>
          )}

          {/* Suggested words */}
          {suggestedWords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Suggested new words
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                AI-identified words that could strengthen your word bank
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestedWords.map(w => (
                  <SuggestedWordCard key={w.word} w={w} onAdd={addSuggestedWord} adding={addingWord} />
                ))}
              </div>
            </div>
          )}

          {!evaluating && candidates.length === 0 && (
            <div className="text-center py-10">
              <Sparkles className="h-6 w-6 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Hit "Generate candidates" to discover JINXable pairs from your word database</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Review tab ─── */}
      {tab === 'review' && (
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No pending prompts.</p>
          ) : (
            <>
              <div className="bg-card border border-border/50 rounded-lg p-3 text-[10px] text-muted-foreground mb-2">
                <p className="font-semibold text-foreground text-xs mb-1">Quality Gate</p>
                <p>✅ Approve: clear shared pathway, likely convergence · ❌ Reject: too abstract or scattered</p>
              </div>
              {pending.map(p => (
                <ExistingPromptCard
                  key={p.id}
                  p={p}
                  updating={updating}
                  onApprove={id => updatePrompt(id, { prompt_status: 'approved' })}
                  onReject={id => updatePrompt(id, { prompt_status: 'rejected' })}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── Library tab ─── */}
      {tab === 'approved' && (
        <div className="space-y-2">
          {approved.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No approved prompts yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">{approved.length} approved prompts</p>
                <button
                  onClick={() => setSortBy(s => s === 'score' ? 'recent' : 'score')}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortBy === 'score' ? 'By score' : 'By date'}
                </button>
              </div>
              {approved.map(p => (
                <ExistingPromptCard
                  key={p.id}
                  p={p}
                  updating={updating}
                  onTagSafe={id => updatePrompt(id, { prompt_tag: 'safe' })}
                  onTagTest={id => updatePrompt(id, { prompt_tag: 'test' })}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── Feedback tab ─── */}
      {tab === 'feedback' && (
        <div className="space-y-2">
          {played.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No played prompts yet.</p>
          ) : (
            played.map(p => (
              <div key={p.id} className="bg-card border border-border/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-display font-bold text-sm">
                    {p.word_a} <span className="text-primary">+</span> {p.word_b}
                  </p>
                  <span className={`text-[10px] font-display font-bold ${
                    p.performance === 'strong' ? 'text-[hsl(var(--keep))]' : p.performance === 'weak' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>{p.performance ?? '—'}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>{p.total_players} players</span>
                  <span>{p.unique_answers} unique</span>
                  <span>Top: {p.top_answer_pct}%</span>
                  {p.prompt_tag && <span className="text-primary">{p.prompt_tag}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
