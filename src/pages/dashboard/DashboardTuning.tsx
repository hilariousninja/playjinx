import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, Loader2, RotateCcw, Sparkles, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_CATEGORIES: Record<string, number> = {
  animals: 50, 'body parts': 50, food: 50, objects: 50, places: 50,
  weather: 50, nature: 50, transport: 50, people: 50, culture: 50,
  events: 50, signals: 50, abstract: 25, emotions: 25,
};

const DEFAULT_CONTROLS: Record<string, number> = {
  concreteness_bias: 60,
  abstractness_penalty: 40,
  consensus_target: 70,
  fragmentation_penalty: 60,
  category_diversity: 70,
};

const CONTROL_META: Record<string, { label: string; desc: string }> = {
  concreteness_bias: { label: 'Concreteness Bias', desc: 'Prefer concrete, tangible word pairs' },
  abstractness_penalty: { label: 'Abstractness Penalty', desc: 'Penalise abstract / vague pairings' },
  consensus_target: { label: 'Consensus Target', desc: 'Target convergence strength for pairs' },
  fragmentation_penalty: { label: 'Fragmentation Penalty', desc: 'Penalise pairs likely to scatter' },
  category_diversity: { label: 'Category Diversity', desc: 'Prefer cross-category pairings in trios' },
};

const weightLabel = (v: number) =>
  v <= 10 ? 'Off' : v <= 25 ? 'Very Low' : v <= 40 ? 'Low' : v <= 60 ? 'Medium' : v <= 80 ? 'High' : 'Very High';

const weightColor = (v: number) =>
  v <= 10 ? 'text-muted-foreground/40' : v <= 25 ? 'text-muted-foreground' : v <= 60 ? 'text-foreground' : 'text-primary';

export default function DashboardTuning() {
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>(DEFAULT_CATEGORIES);
  const [controls, setControls] = useState<Record<string, number>>(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [dbCategories, setDbCategories] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, wordRes] = await Promise.all([
        supabase.from('tuning_settings').select('key, value'),
        supabase.from('words').select('category'),
      ]);

      // Count words per category from actual DB
      const catCounts: Record<string, number> = {};
      for (const w of wordRes.data ?? []) {
        const cat = (w.category || 'Uncategorized').toLowerCase();
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
      setDbCategories(catCounts);

      for (const row of settingsRes.data ?? []) {
        if (row.key === 'category_weights' && typeof row.value === 'object') {
          setCategoryWeights({ ...DEFAULT_CATEGORIES, ...(row.value as Record<string, number>) });
        }
        if (row.key === 'generation_controls' && typeof row.value === 'object') {
          setControls({ ...DEFAULT_CONTROLS, ...(row.value as Record<string, number>) });
        }
      }
    } catch (e) {
      console.error('Failed to load tuning settings', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('tuning_settings').upsert({ key: 'category_weights', value: categoryWeights as any, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('tuning_settings').upsert({ key: 'generation_controls', value: controls as any, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      ]);
      setDirty(false);
      toast.success('Tuning settings saved');
    } catch (e) {
      console.error('Save failed', e);
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setCategoryWeights(DEFAULT_CATEGORIES);
    setControls(DEFAULT_CONTROLS);
    setDirty(true);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      // Save first so edge function uses latest
      await Promise.all([
        supabase.from('tuning_settings').upsert({ key: 'category_weights', value: categoryWeights as any, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('tuning_settings').upsert({ key: 'generation_controls', value: controls as any, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      ]);
      setDirty(false);

      const { data, error } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { ai_generate: true, use_tuning: true },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      console.error('Preview failed', e);
      toast.error(e?.message || 'Preview generation failed');
    }
    setPreviewLoading(false);
  };

  const updateWeight = (cat: string, val: number) => {
    setCategoryWeights(prev => ({ ...prev, [cat]: val }));
    setDirty(true);
  };

  const updateControl = (key: string, val: number) => {
    setControls(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort categories: ones with words first, then alphabetical
  const sortedCategories = Object.keys(categoryWeights).sort((a, b) => {
    const aCount = dbCategories[a] || 0;
    const bCount = dbCategories[b] || 0;
    if (aCount > 0 && bCount === 0) return -1;
    if (aCount === 0 && bCount > 0) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold">Prompt Tuning</h1>
          <p className="text-[10px] text-muted-foreground">Control category weights and generation quality for daily sets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
          <Button size="sm" className="h-7 text-[10px]" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[10px] text-warning">
          Unsaved changes — save before generating preview
        </div>
      )}

      {/* Category Weights */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category Weights</h2>
        <p className="text-[10px] text-muted-foreground">Control how likely each category is to appear in daily prompt generation.</p>
        <div className="grid gap-2">
          {sortedCategories.map((cat, i) => {
            const val = categoryWeights[cat];
            const count = dbCategories[cat] || 0;
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2"
              >
                <div className="w-28 shrink-0">
                  <span className={`text-[11px] font-medium capitalize ${weightColor(val)}`}>{cat}</span>
                  {count > 0 && <span className="text-[9px] text-muted-foreground/50 ml-1">({count})</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <Slider
                    value={[val]}
                    onValueChange={([v]) => updateWeight(cat, v)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="w-16 shrink-0 text-right">
                  <Badge variant="outline" className={`text-[9px] ${weightColor(val)}`}>
                    {weightLabel(val)}
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Generation Controls */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generation Controls</h2>
        <p className="text-[10px] text-muted-foreground">Tune how the AI selects and evaluates candidate pairs.</p>
        <div className="grid gap-2">
          {Object.entries(CONTROL_META).map(([key, meta]) => {
            const val = controls[key] ?? 50;
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
                <div className="w-40 shrink-0">
                  <p className="text-[11px] font-medium">{meta.label}</p>
                  <p className="text-[9px] text-muted-foreground">{meta.desc}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <Slider
                    value={[val]}
                    onValueChange={([v]) => updateControl(key, v)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                <span className="w-8 text-right text-[11px] font-display font-bold text-muted-foreground">{val}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preview */}
      <section className="space-y-3 border-t border-border/30 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview Candidates</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Generate AI candidates using current tuning settings</p>
          </div>
          <Button size="sm" className="h-7 text-[10px]" onClick={handlePreview} disabled={previewLoading}>
            {previewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            Preview trio
          </Button>
        </div>

        {previewLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Generating preview with current settings…</p>
            </div>
          </div>
        )}

        {preview?.pairs && (
          <div className="space-y-2">
            {preview.trio_confidence && (
              <Badge className={`text-[9px] border-0 ${
                preview.trio_confidence === 'strong' ? 'bg-primary/15 text-primary' :
                preview.trio_confidence === 'risky' ? 'bg-destructive/15 text-destructive' :
                'bg-secondary text-muted-foreground'
              }`}>
                Confidence: {preview.trio_confidence}
              </Badge>
            )}
            {preview.trio_reasoning && (
              <p className="text-[10px] text-muted-foreground">{preview.trio_reasoning}</p>
            )}
            {preview.pairs.map((p: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-card border border-border/50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-display font-bold text-sm">{p.word_a} + {p.word_b}</p>
                  <span className="text-xs font-display font-bold text-primary">{p.total_score}/100</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {p.predicted_top_5?.map((a: string, j: number) => (
                    <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      j === 0 ? 'bg-primary/15 text-primary font-bold' : 'bg-secondary text-muted-foreground'
                    }`}>{a}</span>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: 'Consensus', val: p.consensus_strength },
                    { label: 'Frag risk', val: p.fragmentation_risk, invert: true },
                    { label: 'Speed', val: p.fast_comprehension },
                    { label: 'Reveal', val: p.reveal_satisfaction },
                    { label: 'Natural', val: p.naturalness },
                  ].map(({ label, val, invert }) => (
                    <div key={label}>
                      <p className={`text-[10px] font-display font-bold ${
                        invert ? (val <= 30 ? 'text-primary' : val >= 60 ? 'text-destructive' : 'text-muted-foreground')
                        : (val >= 70 ? 'text-primary' : val <= 40 ? 'text-destructive' : 'text-muted-foreground')
                      }`}>{val}</p>
                      <p className="text-[8px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                {p.why_jinxable && <p className="text-[9px] text-muted-foreground mt-1">✓ {p.why_jinxable}</p>}
                {p.why_might_fail && <p className="text-[9px] text-muted-foreground/50">⚠ {p.why_might_fail}</p>}
              </motion.div>
            ))}
            {preview.warnings?.length > 0 && (
              <div className="space-y-1">
                {preview.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-[9px] text-muted-foreground/60">⚠ {w}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent category stats */}
      <section className="space-y-3 border-t border-border/30 pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Word Bank by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
          {Object.entries(dbCategories)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between rounded-md border border-border/30 bg-card px-2.5 py-1.5">
                <span className="text-[10px] capitalize">{cat}</span>
                <span className="text-[10px] font-display font-bold text-muted-foreground">{count}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
