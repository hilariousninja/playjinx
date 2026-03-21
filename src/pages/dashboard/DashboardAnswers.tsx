import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Merge, Trash2, Loader2, AlertTriangle, Plus, ArrowRightLeft,
  Lightbulb, Shield, Check, ArrowLeft
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

interface Alias { id: string; source_text: string; canonical_text: string; alias_type: string; status: string; }
interface BlockedTerm { id: string; term: string; reason: string; }

export default function DashboardAnswers() {
  const [tab, setTab] = useState<'cleanup' | 'aliases' | 'suggestions' | 'blocked'>('cleanup');

  // Cleanup state
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<DbPrompt | null>(null);
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [mergeSourceCount, setMergeSourceCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Aliases state
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [blocked, setBlocked] = useState<BlockedTerm[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedAlias[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

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

  const addAlias = async (source?: string, canonical?: string) => {
    const src = (source ?? newSource).toLowerCase().trim();
    const can = (canonical ?? newCanonical).toLowerCase().trim();
    if (!src || !can || src === can) return;
    setSaving(true);
    await supabase.from('answer_aliases').insert({ source_text: src, canonical_text: can, alias_type: source ? 'suggested' : 'manual', status: 'approved' });
    invalidateAnswerCaches();
    if (!source) { setNewSource(''); setNewCanonical(''); }
    await reloadAliases();
    setSuggestions(prev => prev.filter(s => s.source !== src));
    setSaving(false);
  };

  const deleteAlias = async (id: string) => {
    await supabase.from('answer_aliases').delete().eq('id', id);
    invalidateAnswerCaches();
    reloadAliases();
  };

  const addBlocked = async () => {
    const term = newTerm.toLowerCase().trim();
    if (!term) return;
    setSaving(true);
    await supabase.from('blocked_terms').insert({ term, reason: newReason.trim() || 'Blocked by admin' });
    invalidateAnswerCaches();
    setNewTerm(''); setNewReason('');
    await reloadAliases();
    setSaving(false);
  };

  const deleteBlocked = async (id: string) => {
    await supabase.from('blocked_terms').delete().eq('id', id);
    invalidateAnswerCaches();
    reloadAliases();
  };

  const executeMerge = async () => {
    if (!selectedPrompt || !mergeSource) return;
    setActionLoading(true);
    try {
      await mergeAnswers(selectedPrompt.id, mergeSource, mergeTarget.toLowerCase().trim());
      await loadStats(selectedPrompt.id);
    } catch (e) { console.error(e); }
    setActionLoading(false); setMergeConfirmOpen(false); setMergeSource(null); setMergeTarget('');
  };

  const executeDelete = async () => {
    if (!selectedPrompt || !deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteAnswersByNormalized(selectedPrompt.id, deleteTarget);
      await loadStats(selectedPrompt.id);
    } catch (e) { console.error(e); }
    setActionLoading(false); setDeleteConfirmOpen(false); setDeleteTarget(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-sm font-semibold">Answers</h1>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: 'cleanup', label: 'Cleanup', icon: Merge },
          { key: 'aliases', label: `Aliases (${aliases.length})`, icon: ArrowRightLeft },
          { key: 'suggestions', label: 'Suggestions', icon: Lightbulb },
          { key: 'blocked', label: `Blocked (${blocked.length})`, icon: Shield },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as any); if (t.key === 'suggestions' && suggestions.length === 0 && !suggestionsLoading) loadSuggestions(); }}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Cleanup tab */}
      {tab === 'cleanup' && (
        <div className="space-y-2">
          {!selectedPrompt ? (
            <>
              <p className="text-[10px] text-muted-foreground">Select a prompt to merge or delete answers.</p>
              {prompts.map(p => (
                <button key={p.id} onClick={() => { setSelectedPrompt(p); loadStats(p.id); }}
                  className="bg-card border border-border/50 rounded-xl w-full text-left px-4 py-3 hover:border-primary/20 transition-colors">
                  <span className="font-display text-sm font-bold">{p.word_a}</span>
                  <span className="text-muted-foreground mx-2">+</span>
                  <span className="font-display text-sm font-bold">{p.word_b}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-3">{p.date}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedPrompt(null); setMergeSource(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold">{selectedPrompt.word_a} + {selectedPrompt.word_b}</span>
                <span className="text-[10px] text-muted-foreground">{total} submissions</span>
              </div>
              {statsLoading ? (
                <div className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <div className="space-y-1">
                  {stats.map(s => (
                    <div key={s.normalized_answer} className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <span className="font-display text-[10px] text-muted-foreground/40 w-5 text-right">#{s.rank}</span>
                      <span className="font-display text-sm font-semibold flex-1 break-words min-w-0">{s.normalized_answer}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{s.percentage}% ({s.count})</span>
                      {mergeSource === s.normalized_answer ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} placeholder="Merge into…"
                            className="h-7 w-28 text-xs rounded-lg bg-secondary border-border" autoFocus />
                          <Button size="sm" className="h-7 px-2 text-[10px] rounded-lg" onClick={() => setMergeConfirmOpen(true)} disabled={!mergeTarget.trim()}>Go</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setMergeSource(null)}>✕</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => { setMergeSource(s.normalized_answer); setMergeSourceCount(s.count); setMergeTarget(''); }}><Merge className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
                            onClick={() => { setDeleteTarget(s.normalized_answer); setDeleteCount(s.count); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Aliases tab */}
      {tab === 'aliases' && (
        <div className="space-y-4">
          <p className="text-[10px] text-muted-foreground">Map variant spellings and typos to a canonical answer.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
              <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="e.g. nyc" className="h-9 text-sm rounded-lg" />
            </div>
            <span className="text-muted-foreground pb-2">→</span>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
              <Input value={newCanonical} onChange={e => setNewCanonical(e.target.value)} placeholder="e.g. new york" className="h-9 text-sm rounded-lg" />
            </div>
            <Button onClick={() => addAlias()} disabled={saving || !newSource.trim() || !newCanonical.trim()} size="sm" className="h-9 rounded-lg">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            {aliases.map(a => (
              <div key={a.id} className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <span className="font-display text-sm font-semibold">{a.source_text}</span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className="font-display text-sm text-primary font-semibold">{a.canonical_text}</span>
                <span className="text-[10px] text-muted-foreground/40 ml-auto">{a.alias_type}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive" onClick={() => deleteAlias(a.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {aliases.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No aliases configured.</p>}
          </div>
        </div>
      )}

      {/* Suggestions tab */}
      {tab === 'suggestions' && (
        <div className="space-y-4">
          <p className="text-[10px] text-muted-foreground">Near-miss pairs not auto-merged. Approve as aliases or dismiss.</p>
          {suggestionsLoading ? (
            <div className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (
            <>
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={loadSuggestions}>Rescan</Button>
              <div className="space-y-1.5">
                {suggestions.map(s => (
                  <div key={`${s.source}-${s.canonical}`} className="bg-card border border-border/50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-display text-sm font-semibold">{s.source}</span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className="font-display text-sm text-primary font-semibold">{s.canonical}</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-auto">dist {s.distance}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/50">{s.sourceCount}× vs {s.canonicalCount}× · {s.reason}</span>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 px-2.5 text-[10px] rounded-lg" onClick={() => addAlias(s.source, s.canonical)} disabled={saving}>
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-muted-foreground/50" onClick={() => setSuggestions(prev => prev.filter(x => x.source !== s.source))}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {suggestions.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No suggestions found.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Blocked tab */}
      {tab === 'blocked' && (
        <div className="space-y-4">
          <p className="text-[10px] text-muted-foreground">Block offensive or spam terms from answers.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Term</label>
              <Input value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="e.g. offensive word" className="h-9 text-sm rounded-lg" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason</label>
              <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. offensive" className="h-9 text-sm rounded-lg" />
            </div>
            <Button onClick={addBlocked} disabled={saving || !newTerm.trim()} size="sm" className="h-9 rounded-lg">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            {blocked.map(b => (
              <div key={b.id} className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <span className="font-display text-sm font-semibold text-destructive">{b.term}</span>
                {b.reason && <span className="text-[10px] text-muted-foreground/50">{b.reason}</span>}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto text-muted-foreground/50 hover:text-destructive" onClick={() => deleteBlocked(b.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {blocked.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No blocked terms.</p>}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle><Merge className="h-4 w-4 inline mr-2" />Merge Answers</AlertDialogTitle>
            <AlertDialogDescription>Merge <strong>"{mergeSource}"</strong> into <strong>"{mergeTarget}"</strong>? ({mergeSourceCount} submissions)</AlertDialogDescription>
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
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive"><AlertTriangle className="h-4 w-4 inline mr-2" />Delete Answer</AlertDialogTitle>
            <AlertDialogDescription>Delete <strong>"{deleteTarget}"</strong>? ({deleteCount} submissions)</AlertDialogDescription>
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
