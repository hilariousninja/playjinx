import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Shield, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { invalidateAnswerCaches } from '@/lib/answer-helpers';

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
  const [loading, setLoading] = useState(true);

  // Alias form
  const [newSource, setNewSource] = useState('');
  const [newCanonical, setNewCanonical] = useState('');

  // Blocked form
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

  const addAlias = async () => {
    const src = newSource.toLowerCase().trim();
    const can = newCanonical.toLowerCase().trim();
    if (!src || !can || src === can) return;
    setSaving(true);
    await supabase.from('answer_aliases').insert({
      source_text: src,
      canonical_text: can,
      alias_type: 'manual',
      status: 'approved',
    });
    invalidateAnswerCaches();
    setNewSource('');
    setNewCanonical('');
    await loadData();
    setSaving(false);
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
    await supabase.from('blocked_terms').insert({
      term,
      reason: newReason.trim() || 'Blocked by admin',
    });
    invalidateAnswerCaches();
    setNewTerm('');
    setNewReason('');
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
            <TabsTrigger value="blocked" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Blocked Terms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aliases" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Map variant spellings and typos to a canonical answer. New submissions using the source text will be stored as the canonical text instead.
            </p>

            {/* Add form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
                <Input
                  value={newSource}
                  onChange={e => setNewSource(e.target.value)}
                  placeholder="e.g. nyc"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <span className="text-muted-foreground pb-2">→</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
                <Input
                  value={newCanonical}
                  onChange={e => setNewCanonical(e.target.value)}
                  placeholder="e.g. new york"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <Button onClick={addAlias} disabled={saving || !newSource.trim() || !newCanonical.trim()} size="sm" className="h-9 rounded-lg">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            {/* Alias list */}
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

          <TabsContent value="blocked" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Block offensive or spam terms. Answers containing these terms will be rejected at submission.
            </p>

            {/* Add form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Term</label>
                <Input
                  value={newTerm}
                  onChange={e => setNewTerm(e.target.value)}
                  placeholder="e.g. offensive word"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reason (optional)</label>
                <Input
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  placeholder="e.g. offensive"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <Button onClick={addBlocked} disabled={saving || !newTerm.trim()} size="sm" className="h-9 rounded-lg">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            {/* Blocked list */}
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
