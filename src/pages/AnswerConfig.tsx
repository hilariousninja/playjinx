import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Shield, ArrowRightLeft, Lightbulb, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { invalidateAnswerCaches } from '@/lib/answer-helpers';
import { getSuggestedAliases, type SuggestedAlias } from '@/lib/store';

interface Alias {
  id: string;
  source_text: string;
  canonical_text: string;
  alias_type: string;
  status: string;
}

interface BlockedTerm {
  id: string;
  term: string;
  reason: string;
}

export default function AnswerConfig() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [blocked, setBlocked] = useState<BlockedTerm[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [newSource, setNewSource] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [aliasRes, blockedRes] = await Promise.all([
      supabase.from('answer_aliases').select('*').order('created_at', { ascending: false }),
      supabase.from('blocked_terms').select('*').order('created_at', { ascending: false }),
    ]);
    setAliases((aliasRes.data ?? []) as Alias[]);
    setBlocked((blockedRes.data ?? []) as BlockedTerm[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const s = await getSuggestedAliases();
      const existingAliases = new Set(aliases.map(a => a.source_text));
      setSuggestions(s.filter(sg => !existingAliases.has(sg.source)));
    } catch (e) {
      console.error('Failed to load suggestions:', e);
    }
    setSuggestionsLoading(false);
  }, [aliases]);

  const addAlias = async (source?: string, canonical?: string) => {
    const src = (source ?? newSource).toLowerCase().trim();
    const can = (canonical ?? newCanonical).toLowerCase().trim();
    if (!src || !can || src === can) return;
    setSaving(true);
    await supabase.from('answer_aliases').insert({
      source_text: src,
      canonical_text: can,
      alias_type: source ? 'suggested' : 'manual',
      status: 'approved',
    });
    invalidateAnswerCaches();
    if (!source) { setNewSource(''); setNewCanonical(''); }
    await loadData();
    setSuggestions(prev => prev.filter(s => s.source !== src));
    setSaving(false);
  };

  const dismissSuggestion = (source: string) => {
    setSuggestions(prev => prev.filter(s => s.source !== source));
  };

  const deleteAlias = async (id: string) => {
    await supabase.from('answer_aliases').delete().eq('id', id);
    invalidateAnswerCaches();
    loadData();
  };

  const addBlocked = async () => {
    const term = newTerm.toLowerCase().trim();
    if (!term) return;
    setSaving(true);
    await supabase.from('blocked_terms').insert({ term, reason: newReason.trim() || 'Blocked by admin' });
    invalidateAnswerCaches();
    setNewTerm(''); setNewReason('');
    await loadData();
    setSaving(false);
  };

  const deleteBlocked = async (id: string) => {
    await supabase.from('blocked_terms').delete().eq('id', id);
    invalidateAnswerCaches();
    loadData();
  };

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
          <span className="font-display text-sm font-bold tracking-tight">Answer Config</span>
        </div>
      </nav>

      <div className="container max-w-2xl py-5">
        <Tabs defaultValue="aliases">
          <TabsList className="mb-4">
            <TabsTrigger value="aliases" className="gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Aliases
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1.5" onClick={() => { if (suggestions.length === 0 && !suggestionsLoading) loadSuggestions(); }}>
              <Lightbulb className="h-3.5 w-3.5" /> Suggestions
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Blocked
            </TabsTrigger>
          </TabsList>

          {/* Aliases tab */}
          <TabsContent value="aliases" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Map variant spellings and typos to a canonical answer. Aliases are applied first, before fuzzy merging.
            </p>
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
                <div key={a.id} className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <span className="font-display text-sm font-semibold">{a.source_text}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="font-display text-sm text-primary font-semibold">{a.canonical_text}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{a.alias_type}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive" onClick={() => deleteAlias(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {aliases.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No aliases configured.</p>}
            </div>
          </TabsContent>

          {/* Suggestions tab */}
          <TabsContent value="suggestions" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Near-miss answer pairs from recent prompts that were <strong>not</strong> auto-merged. Approve as aliases or dismiss.
            </p>
            {suggestionsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Scanning recent prompts…</p>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={loadSuggestions}>
                  Rescan prompts
                </Button>
                <div className="space-y-1.5">
                  {suggestions.map(s => (
                    <div key={`${s.source}-${s.canonical}`} className="bg-card border border-border rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold">{s.source}</span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-display text-sm text-primary font-semibold">{s.canonical}</span>
                        <span className="text-[10px] text-muted-foreground/40 ml-auto">dist {s.distance}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground/50">
                          {s.sourceCount}× vs {s.canonicalCount}× · {s.reason}
                        </span>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 px-2.5 text-[10px] rounded-lg" onClick={() => addAlias(s.source, s.canonical)} disabled={saving}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-muted-foreground/50" onClick={() => dismissSuggestion(s.source)}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {suggestions.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No suggestions found. All near-miss pairs are either already aliased or within auto-merge thresholds.
                    </p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Blocked tab */}
          <TabsContent value="blocked" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Block offensive or spam terms. Answers containing these terms will be rejected at submission.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Term</label>
                <Input value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="e.g. offensive word" className="h-9 text-sm rounded-lg" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason (optional)</label>
                <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. offensive" className="h-9 text-sm rounded-lg" />
              </div>
              <Button onClick={addBlocked} disabled={saving || !newTerm.trim()} size="sm" className="h-9 rounded-lg">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-1">
              {blocked.map(b => (
                <div key={b.id} className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <span className="font-display text-sm font-semibold text-destructive">{b.term}</span>
                  {b.reason && <span className="text-[10px] text-muted-foreground/50">{b.reason}</span>}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto text-muted-foreground/50 hover:text-destructive" onClick={() => deleteBlocked(b.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {blocked.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No blocked terms configured.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
