import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Merge, Trash2, Loader2, AlertTriangle, Plus, ArrowRightLeft,
  Lightbulb, Shield, Check, ArrowLeft, RefreshCw, Search,
  ChevronDown, ChevronUp, Sparkles, Ban, Eye, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getActivePrompts, getArchivePrompts, getStats, mergeAnswers, deleteAnswersByNormalized,
  getTotalSubmissions, getSuggestedAliases,
  type DbPrompt, type AnswerStat, type SuggestedAlias,
} from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { invalidateAnswerCaches } from '@/lib/answer-helpers';
import { toast } from 'sonner';

// ─── Types ───
interface Alias { id: string; source_text: string; canonical_text: string; alias_type: string; status: string; created_at: string; }
interface BlockedTerm { id: string; term: string; reason: string; }

type SuggestionType = 'typo' | 'spelling' | 'plural' | 'format' | 'alias' | 'near-miss' | 'distinct';

function classifySuggestion(s: SuggestedAlias): { type: SuggestionType; label: string; cls: string; confidence: 'high' | 'medium' | 'low' } {
  const a = s.source.toLowerCase();
  const b = s.canonical.toLowerCase();

  // Plural variant
  if (a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a ||
      (a.endsWith('ies') && b.endsWith('y') && a.slice(0, -3) === b.slice(0, -1)) ||
      (b.endsWith('ies') && a.endsWith('y') && b.slice(0, -3) === a.slice(0, -1))) {
    return { type: 'plural', label: 'Plural variant', cls: 'bg-[hsl(var(--keep))]/15 text-[hsl(var(--keep))]', confidence: 'high' };
  }

  // Single character difference on short words = likely typo
  if (s.distance === 1 && a.length >= 5) {
    return { type: 'typo', label: 'Likely typo', cls: 'bg-primary/15 text-primary', confidence: 'high' };
  }

  // Spelling variant (distance 1-2 on longer words)
  if (s.distance <= 2 && a.length >= 7) {
    return { type: 'spelling', label: 'Spelling variant', cls: 'bg-primary/15 text-primary', confidence: 'medium' };
  }

  // Count ratio suggests near-miss that should stay separate
  if (s.sourceCount > 2 && s.canonicalCount > 2 && s.sourceCount > s.canonicalCount * 0.4) {
    return { type: 'near-miss', label: 'Near miss — review', cls: 'bg-[hsl(var(--review))]/15 text-[hsl(var(--review))]', confidence: 'low' };
  }

  if (s.distance <= 2) {
    return { type: 'alias', label: 'Possible alias', cls: 'bg-secondary text-secondary-foreground', confidence: 'medium' };
  }

  return { type: 'distinct', label: 'Likely distinct', cls: 'bg-destructive/15 text-destructive', confidence: 'low' };
}

function getImpactText(s: SuggestedAlias): string {
  const total = s.sourceCount + s.canonicalCount;
  return `Would merge ${s.sourceCount} answer${s.sourceCount !== 1 ? 's' : ''} into "${s.canonical}" (${total} total)`;
}

// ─── Section wrapper ───
function Section({ title, count, icon: Icon, children, defaultOpen = true }: {
  title: string; count?: number; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-border/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ───
export default function DashboardAnswers() {
  // Data
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [blocked, setBlocked] = useState<BlockedTerm[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Cleanup drill-down
  const [selectedPrompt, setSelectedPrompt] = useState<DbPrompt | null>(null);
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [total, setTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  // Merge/delete state
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [mergeSourceCount, setMergeSourceCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // New alias / blocked inputs
  const [newSource, setNewSource] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Search
  const [aliasSearch, setAliasSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [active, archive, aliasRes, blockedRes] = await Promise.all([
        getActivePrompts(),
        getArchivePrompts(),
        supabase.from('answer_aliases').select('*').order('created_at', { ascending: false }),
        supabase.from('blocked_terms').select('*').order('created_at', { ascending: false }),
      ]);
      const all = [...active, ...archive];
      const seen = new Set<string>();
      setPrompts(all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
      setAliases((aliasRes.data ?? []) as Alias[]);
      setBlocked((blockedRes.data ?? []) as BlockedTerm[]);
      setLoading(false);
    })();
  }, []);

  const loadStats = useCallback(async (promptId: string) => {
    setStatsLoading(true);
    const [s, t] = await Promise.all([getStats(promptId), getTotalSubmissions(promptId)]);
    setStats(s); setTotal(t); setStatsLoading(false);
  }, []);

  const reloadAliases = async () => {
    const [aliasRes, blockedRes] = await Promise.all([
      supabase.from('answer_aliases').select('*').order('created_at', { ascending: false }),
      supabase.from('blocked_terms').select('*').order('created_at', { ascending: false }),
    ]);
    setAliases((aliasRes.data ?? []) as Alias[]);
    setBlocked((blockedRes.data ?? []) as BlockedTerm[]);
  };

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const s = await getSuggestedAliases();
      const existing = new Set(aliases.map(a => a.source_text));
      setSuggestions(s.filter(sg => !existing.has(sg.source)));
    } catch (e) { console.error(e); }
    setSuggestionsLoading(false);
  }, [aliases]);

  // Auto-load suggestions on mount
  useEffect(() => {
    if (!loading && suggestions.length === 0 && !suggestionsLoading) {
      loadSuggestions();
    }
  }, [loading]);

  const addAlias = async (source?: string, canonical?: string) => {
    const src = (source ?? newSource).toLowerCase().trim();
    const can = (canonical ?? newCanonical).toLowerCase().trim();
    if (!src || !can || src === can) return;
    setSaving(true);
    await supabase.from('answer_aliases').insert({
      source_text: src, canonical_text: can,
      alias_type: source ? 'suggested' : 'manual', status: 'approved',
    });
    invalidateAnswerCaches();
    if (!source) { setNewSource(''); setNewCanonical(''); }
    await reloadAliases();
    setSuggestions(prev => prev.filter(s => s.source !== src));
    toast.success(`Alias created: ${src} → ${can}`);
    setSaving(false);
  };

  const deleteAlias = async (id: string) => {
    await supabase.from('answer_aliases').delete().eq('id', id);
    invalidateAnswerCaches();
    toast.success('Alias removed');
    reloadAliases();
  };

  const addBlocked = async () => {
    const term = newTerm.toLowerCase().trim();
    if (!term) return;
    setSaving(true);
    await supabase.from('blocked_terms').insert({ term, reason: newReason.trim() || 'Blocked by admin' });
    invalidateAnswerCaches();
    setNewTerm(''); setNewReason('');
    toast.success(`"${term}" blocked`);
    await reloadAliases();
    setSaving(false);
  };

  const deleteBlocked = async (id: string) => {
    await supabase.from('blocked_terms').delete().eq('id', id);
    invalidateAnswerCaches();
    toast.success('Term unblocked');
    reloadAliases();
  };

  const executeMerge = async () => {
    if (!selectedPrompt || !mergeSource) return;
    setActionLoading(true);
    try {
      await mergeAnswers(selectedPrompt.id, mergeSource, mergeTarget.toLowerCase().trim());
      toast.success(`Merged "${mergeSource}" → "${mergeTarget}"`);
      await loadStats(selectedPrompt.id);
    } catch (e) { console.error(e); toast.error('Merge failed'); }
    setActionLoading(false); setMergeConfirmOpen(false); setMergeSource(null); setMergeTarget('');
  };

  const executeDelete = async () => {
    if (!selectedPrompt || !deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteAnswersByNormalized(selectedPrompt.id, deleteTarget);
      toast.success(`Deleted "${deleteTarget}"`);
      await loadStats(selectedPrompt.id);
    } catch (e) { console.error(e); toast.error('Delete failed'); }
    setActionLoading(false); setDeleteConfirmOpen(false); setDeleteTarget(null);
  };

  // Computed
  const filteredAliases = useMemo(() => {
    if (!aliasSearch.trim()) return aliases;
    const q = aliasSearch.toLowerCase();
    return aliases.filter(a => a.source_text.includes(q) || a.canonical_text.includes(q));
  }, [aliases, aliasSearch]);

  const classifiedSuggestions = useMemo(() =>
    suggestions
      .map(s => ({ ...s, classification: classifySuggestion(s) }))
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.classification.confidence] - order[b.classification.confidence];
      }),
    [suggestions]
  );

  // Prompts needing cleanup: high one-off rate or many near-duplicates
  const needsCleanup = useMemo(() =>
    prompts
      .filter(p => p.total_players >= 5)
      .filter(p => {
        const ratio = p.unique_answers / p.total_players;
        return ratio > 0.6 || p.performance === 'weak';
      })
      .sort((a, b) => {
        const rA = a.unique_answers / a.total_players;
        const rB = b.unique_answers / b.total_players;
        return rB - rA;
      })
      .slice(0, 8),
    [prompts]
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // Drill-down view
  if (selectedPrompt) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedPrompt(null); setMergeSource(null); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to answer hygiene
        </button>

        <div className="bg-card border border-border/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-base">
                {selectedPrompt.word_a} <span className="text-primary">+</span> {selectedPrompt.word_b}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{selectedPrompt.date}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{total} answers</span>
              <span>{stats.length} unique</span>
              {total > 0 && (
                <span className={`font-display font-bold ${
                  stats[0] && stats[0].percentage >= 40 ? 'text-[hsl(var(--keep))]' : stats[0]?.percentage >= 20 ? 'text-primary' : 'text-destructive'
                }`}>
                  Top: {stats[0]?.percentage ?? 0}%
                </span>
              )}
            </div>
          </div>
        </div>

        {statsLoading ? (
          <div className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1">
            {stats.map(s => (
              <div key={s.normalized_answer} className="bg-card border border-border/50 rounded-lg px-4 py-2.5 flex items-center gap-2">
                <span className="font-display text-[10px] text-muted-foreground/40 w-5 text-right shrink-0">#{s.rank}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-sm font-semibold break-words">{s.normalized_answer}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{s.percentage}%</span>
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums">({s.count})</span>
                </div>
                {mergeSource === s.normalized_answer ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} placeholder="Merge into…"
                      className="h-7 w-28 text-xs rounded-lg bg-secondary border-border" autoFocus />
                    <Button size="sm" className="h-7 px-2 text-[10px] rounded-lg" onClick={() => setMergeConfirmOpen(true)} disabled={!mergeTarget.trim()}>Go</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => setMergeSource(null)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground"
                      onClick={() => { setMergeSource(s.normalized_answer); setMergeSourceCount(s.count); setMergeTarget(''); }}
                      title="Merge into another answer">
                      <Merge className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
                      onClick={() => { setDeleteTarget(s.normalized_answer); setDeleteCount(s.count); setDeleteConfirmOpen(true); }}
                      title="Delete this answer">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Dialogs */}
        <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
          <AlertDialogContent className="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Merge className="h-4 w-4" /> Merge answers</AlertDialogTitle>
              <AlertDialogDescription>
                Merge <strong className="text-foreground">"{mergeSource}"</strong> ({mergeSourceCount} submissions) into <strong className="text-foreground">"{mergeTarget}"</strong>?
                <br /><span className="text-[11px] text-muted-foreground/70 mt-1 block">Original raw submissions are preserved. Only the grouping changes.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeMerge} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Merge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent className="rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Delete answer</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete <strong className="text-foreground">"{deleteTarget}"</strong> ({deleteCount} submissions)?
                <br /><span className="text-[11px] text-muted-foreground/70 mt-1 block">This removes the submissions entirely and cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main view
  const highConfidence = classifiedSuggestions.filter(s => s.classification.confidence === 'high');
  const otherSuggestions = classifiedSuggestions.filter(s => s.classification.confidence !== 'high');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Answer Hygiene</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Keep JINX results clean, fair, and trustworthy
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{aliases.length} aliases</span>
          <span>{blocked.length} blocked</span>
          <span>{suggestions.length} suggestions</span>
        </div>
      </div>

      {/* ─── Suggestions (high priority) ─── */}
      {highConfidence.length > 0 && (
        <Section title="High-confidence suggestions" count={highConfidence.length} icon={Sparkles}>
          <p className="text-[10px] text-muted-foreground mb-3">
            These are very likely the same answer. Approve to improve result accuracy.
          </p>
          <div className="space-y-1.5">
            {highConfidence.map(s => (
              <div key={`${s.source}-${s.canonical}`} className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold">{s.source}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="font-display text-sm text-primary font-semibold">{s.canonical}</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${s.classification.cls}`}>
                    {s.classification.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground space-x-3">
                    <span>{s.sourceCount}× vs {s.canonicalCount}×</span>
                    <span className="text-muted-foreground/50">dist {s.distance}</span>
                    <span className="text-muted-foreground/60">{getImpactText(s)}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-7 px-2.5 text-[10px] rounded-lg" onClick={() => addAlias(s.source, s.canonical)} disabled={saving}>
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-muted-foreground/50"
                      onClick={() => setSuggestions(prev => prev.filter(x => x.source !== s.source))}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ─── Review suggestions (lower confidence) ─── */}
      <Section
        title="Review suggestions"
        count={otherSuggestions.length}
        icon={Lightbulb}
        defaultOpen={highConfidence.length === 0 && otherSuggestions.length > 0}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-muted-foreground">
            Near-miss pairs that need human judgment. Check whether these are genuine variants or distinct answers.
          </p>
          <Button variant="outline" size="sm" className="rounded-lg text-[10px] h-7 shrink-0" onClick={loadSuggestions} disabled={suggestionsLoading}>
            {suggestionsLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Rescan
          </Button>
        </div>

        {suggestionsLoading ? (
          <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
        ) : otherSuggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No suggestions to review.</p>
        ) : (
          <div className="space-y-1.5">
            {otherSuggestions.map(s => (
              <div key={`${s.source}-${s.canonical}`} className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold">{s.source}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="font-display text-sm text-primary font-semibold">{s.canonical}</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${s.classification.cls}`}>
                    {s.classification.label}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="text-[10px] text-muted-foreground space-x-3">
                    <span>{s.sourceCount}× vs {s.canonicalCount}×</span>
                    <span className="text-muted-foreground/50">dist {s.distance} · {s.reason}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px] rounded-lg" onClick={() => addAlias(s.source, s.canonical)} disabled={saving}>
                      <Check className="h-3 w-3 mr-1" /> Merge
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-muted-foreground/50"
                      onClick={() => setSuggestions(prev => prev.filter(x => x.source !== s.source))}>
                      Keep separate
                    </Button>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/50 mt-1">{getImpactText(s)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Alias rules ─── */}
      <Section title="Alias rules" count={aliases.length} icon={ArrowRightLeft} defaultOpen={false}>
        <p className="text-[10px] text-muted-foreground mb-3">
          Active alias mappings. Variants on the left are grouped under the canonical answer on the right.
        </p>

        {/* Add new */}
        <div className="flex gap-2 items-end mb-3">
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 block">From (variant)</label>
            <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="e.g. nyc" className="h-8 text-xs rounded-lg" />
          </div>
          <span className="text-muted-foreground pb-1.5 text-xs">→</span>
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 block">To (canonical)</label>
            <Input value={newCanonical} onChange={e => setNewCanonical(e.target.value)} placeholder="e.g. new york" className="h-8 text-xs rounded-lg" />
          </div>
          <Button onClick={() => addAlias()} disabled={saving || !newSource.trim() || !newCanonical.trim()} size="sm" className="h-8 rounded-lg text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {/* Search */}
        {aliases.length > 5 && (
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <Input
              value={aliasSearch}
              onChange={e => setAliasSearch(e.target.value)}
              placeholder="Search aliases…"
              className="h-7 text-xs rounded-lg pl-7"
            />
          </div>
        )}

        {/* List */}
        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {filteredAliases.map(a => (
            <div key={a.id} className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-display text-xs font-semibold">{a.source_text}</span>
              <span className="text-muted-foreground/40 text-[10px]">→</span>
              <span className="font-display text-xs text-primary font-semibold">{a.canonical_text}</span>
              <span className={`text-[8px] ml-auto px-1.5 py-0.5 rounded-full ${
                a.alias_type === 'manual' ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary'
              }`}>{a.alias_type}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/30 hover:text-destructive" onClick={() => deleteAlias(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {filteredAliases.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {aliasSearch ? 'No matching aliases.' : 'No aliases configured yet.'}
            </p>
          )}
        </div>
      </Section>

      {/* ─── Blocked terms ─── */}
      <Section title="Blocked terms" count={blocked.length} icon={Ban} defaultOpen={false}>
        <p className="text-[10px] text-muted-foreground mb-3">
          Blocked answers are rejected at submission time. Use for offensive, spam, or nonsensical terms.
        </p>

        <div className="flex gap-2 items-end mb-3">
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 block">Term</label>
            <Input value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="e.g. offensive word" className="h-8 text-xs rounded-lg" />
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason (optional)</label>
            <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. offensive" className="h-8 text-xs rounded-lg" />
          </div>
          <Button onClick={addBlocked} disabled={saving || !newTerm.trim()} size="sm" className="h-8 rounded-lg text-xs">
            <Plus className="h-3 w-3 mr-1" /> Block
          </Button>
        </div>

        <div className="space-y-1">
          {blocked.map(b => (
            <div key={b.id} className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-display text-xs font-semibold text-destructive">{b.term}</span>
              {b.reason && <span className="text-[9px] text-muted-foreground/50 ml-1">{b.reason}</span>}
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto text-muted-foreground/30 hover:text-destructive" onClick={() => deleteBlocked(b.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {blocked.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No blocked terms.</p>}
        </div>
      </Section>

      {/* ─── Prompts needing cleanup ─── */}
      <Section title="Needs cleanup" count={needsCleanup.length} icon={AlertTriangle} defaultOpen={needsCleanup.length > 0}>
        <p className="text-[10px] text-muted-foreground mb-3">
          Prompts with high fragmentation or weak convergence that may benefit from answer cleanup.
        </p>
        {needsCleanup.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No prompts flagged for cleanup.</p>
        ) : (
          <div className="space-y-1">
            {needsCleanup.map(p => {
              const fragRate = p.total_players > 0 ? Math.round((p.unique_answers / p.total_players) * 100) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPrompt(p); loadStats(p.id); }}
                  className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg w-full text-left px-3 py-2.5 hover:border-primary/20 transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-display text-sm font-bold">{p.word_a}</span>
                    <span className="text-primary mx-1.5">+</span>
                    <span className="font-display text-sm font-bold">{p.word_b}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                    <span>{p.total_players}p</span>
                    <span>{p.unique_answers} unique</span>
                    <span className={fragRate > 70 ? 'text-destructive font-semibold' : fragRate > 50 ? 'text-[hsl(var(--review))]' : ''}>
                      {fragRate}% fragmented
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* ─── Browse all prompts ─── */}
      <Section title="Browse prompt answers" count={prompts.filter(p => p.total_players > 0).length} icon={Eye} defaultOpen={false}>
        <p className="text-[10px] text-muted-foreground mb-3">
          Select any prompt to view and clean up its answer distribution.
        </p>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {prompts.filter(p => p.total_players > 0).map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedPrompt(p); loadStats(p.id); }}
              className="bg-[hsl(var(--surface-elevated))] border border-border/30 rounded-lg w-full text-left px-3 py-2 hover:border-primary/20 transition-colors flex items-center gap-2"
            >
              <span className="font-display text-xs font-bold">{p.word_a}</span>
              <span className="text-primary text-xs">+</span>
              <span className="font-display text-xs font-bold">{p.word_b}</span>
              <span className="text-[10px] text-muted-foreground/40 ml-auto">{p.date}</span>
              <span className="text-[10px] text-muted-foreground/50">{p.total_players}p</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
