import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Loader2, RefreshCw, AlertTriangle, Sparkles, Shield, Archive, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SourceType = 'future_bank' | 'generated_new' | 'reused_archive';

const sourceLabel: Record<SourceType, { label: string; cls: string; icon: any }> = {
  future_bank: { label: 'Future bank', cls: 'bg-primary/10 text-primary', icon: Shield },
  generated_new: { label: 'Generated new', cls: 'bg-accent text-accent-foreground', icon: Sparkles },
  reused_archive: { label: '⚠ Reused archive', cls: 'bg-destructive/10 text-destructive', icon: Archive },
};

export default function DashboardDaily() {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { dry_run: true },
      });
      setAuditData(data);
    } catch (e) {
      console.error('Audit load failed', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const handleRegenerate = async () => {
    const confirmed = confirm('Force regenerate today\'s daily set from the approved future bank? This will deactivate the current set.');
    if (!confirmed) return;
    setRegenerating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('prompts').update({ active: false, mode: 'archive' }).eq('active', true).eq('date', today);
      const { data } = await supabase.functions.invoke('generate-daily-prompts');
      if (data) setAuditData(data);
      else await loadAudit();
      toast.success('Daily set regenerated');
    } catch (e) {
      console.error('Regenerate failed', e);
      toast.error('Regeneration failed');
    }
    setRegenerating(false);
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-prompts', {
        body: { ai_generate: true },
      });
      if (error) throw error;
      setAiResult(data);
      toast.success('AI trio generated');
    } catch (e: any) {
      console.error('AI generation failed', e);
      toast.error(e?.message || 'AI generation failed');
    }
    setAiGenerating(false);
  };

  const handleAcceptAiTrio = async () => {
    if (!aiResult?.pairs?.length) return;
    const confirmed = confirm(`Accept this AI trio and add ${aiResult.pairs.length} pairs to the approved future bank?`);
    if (!confirmed) return;
    setAcceptingIdx(0);
    try {
      for (let i = 0; i < aiResult.pairs.length; i++) {
        setAcceptingIdx(i);
        const p = aiResult.pairs[i];
        const { error } = await supabase.from('prompts').insert({
          word_a: p.word_a.toUpperCase(),
          word_b: p.word_b.toUpperCase(),
          prompt_score: p.total_score ?? 50,
          prompt_status: 'approved',
          prompt_tag: 'safe',
          mode: 'daily',
        });
        if (error) throw error;
      }
      toast.success(`${aiResult.pairs.length} pairs added to future bank`);
      setAiResult(null);
      await loadAudit();
    } catch (e) {
      console.error('Accept failed', e);
      toast.error('Failed to accept trio');
    }
    setAcceptingIdx(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Analysing daily set…</p>
        </div>
      </div>
    );
  }

  const confidence = auditData?.editorial_confidence;
  const confidenceConfig = confidence === 'strong'
    ? { label: '✦ Strong', cls: 'bg-primary/15 text-primary', desc: 'This trio should produce satisfying gameplay.' }
    : confidence === 'acceptable'
    ? { label: '● Acceptable', cls: 'bg-secondary text-muted-foreground', desc: 'Decent set, but could be stronger.' }
    : { label: '⚠ Risky', cls: 'bg-destructive/15 text-destructive', desc: 'Consider regenerating — this set may underperform.' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold">Daily Sets</h1>
          <p className="text-[10px] text-muted-foreground">Select today’s 3 from future bank or generate clean replacements.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={loadAudit}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
            Generate today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
        <span className="rounded-full border border-border/50 px-2 py-0.5">1. Maintain words</span>
        <span className="rounded-full border border-border/50 px-2 py-0.5">2. Review candidates</span>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-primary">3. Publish today’s 3</span>
        <span className="rounded-full border border-border/50 px-2 py-0.5">4. Learn + archive</span>
      </div>

      {/* Warnings */}
      {auditData?.warnings?.length > 0 && (
        <div className="space-y-1.5">
          {auditData.warnings.map((w: string, i: number) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-[11px] text-destructive">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lifecycle summary */}
      {auditData?.lifecycle && (
        <div className="flex items-center gap-3">
          {auditData.lifecycle.future_bank > 0 && (
            <Badge variant="outline" className="border-primary/30 text-[9px] text-primary">
              <Shield className="mr-1 h-2.5 w-2.5" /> {auditData.lifecycle.future_bank} from future bank
            </Badge>
          )}
          {auditData.lifecycle.generated_new > 0 && (
            <Badge variant="outline" className="border-accent text-[9px] text-accent-foreground">
              <Sparkles className="mr-1 h-2.5 w-2.5" /> {auditData.lifecycle.generated_new} generated new
            </Badge>
          )}
          {auditData.lifecycle.reused_archive > 0 && (
            <Badge variant="outline" className="border-destructive/30 text-[9px] text-destructive">
              <Archive className="mr-1 h-2.5 w-2.5" /> {auditData.lifecycle.reused_archive} reused archive
            </Badge>
          )}
        </div>
      )}

      {auditData && (
        <>
          {/* Confidence summary */}
          <div className={`rounded-lg p-4 border ${
            confidence === 'strong' ? 'border-primary/20 bg-primary/5' :
            confidence === 'risky' ? 'border-destructive/20 bg-destructive/5' :
            'border-border/50 bg-card'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full ${confidenceConfig.cls}`}>
                {confidenceConfig.label}
              </span>
              <span className="text-sm font-display font-bold text-muted-foreground">
                Score: {auditData.trio_quality_score}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{confidenceConfig.desc}</p>
            <p className="font-display font-bold text-lg mt-3">{auditData.trio}</p>
          </div>

          {/* Individual prompts */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pair Breakdown</h2>
            {auditData.prompts?.map((p: any, i: number) => {
              const src = sourceLabel[p.source as SourceType] ?? sourceLabel.generated_new;
              const SrcIcon = src.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border/50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-display font-bold text-base">{p.pair}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] border-0 ${src.cls}`}>
                        <SrcIcon className="h-2.5 w-2.5 mr-0.5" />{src.label}
                      </Badge>
                      {p.tag && <Badge className={`text-[9px] border-0 ${p.tag === 'safe' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>{p.tag}</Badge>}
                    </div>
                  </div>
                  {p.has_answer_history && (
                    <div className="flex items-center gap-1 mb-2">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] text-destructive font-medium">Has existing answer history — reused from archive</span>
                    </div>
                  )}
                  {p.total_players > 0 ? (
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>{p.total_players} players</span>
                      <span>{p.unique_answers} unique</span>
                      <span>Top: {p.top_answer_pct}%</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Fresh — no play history</p>
                  )}
                  {p.quality && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(p.quality.details as Record<string, number>).map(([key, val]) => (
                        <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          val > 0 ? 'bg-primary/10 text-primary' : val < 0 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
                        }`}>
                          {key}: {val > 0 ? '+' : ''}{val}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Score breakdown */}
          {auditData.score_breakdown && (
            <div className="bg-card border border-border/50 rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Trio Score Breakdown</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
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
            <div className="bg-card border border-border/50 rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Runner-up Trios {auditData.candidates_sampled && <span className="text-foreground/40">({auditData.candidates_sampled} sampled)</span>}
              </h2>
              {auditData.runner_ups.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-t border-border/30 first:border-t-0">
                  <span className="text-[11px] font-display">{r.trio}</span>
                  <span className="text-[10px] font-display font-bold text-muted-foreground">{r.score}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── AI Trio Generation ─── */}
      <div className="border-t border-border/30 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generate AI Trio</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Create 3 fresh AI-scored pairs from your source words for the future bank</p>
          </div>
          <Button
            size="sm"
            className="h-7 text-[10px]"
            onClick={handleAiGenerate}
            disabled={aiGenerating}
          >
            {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
            Generate fresh trio
          </Button>
        </div>

        {aiGenerating && (
          <div className="flex items-center justify-center py-10">
            <div className="text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">AI is generating convergence pairs…</p>
            </div>
          </div>
        )}

        {aiResult && (
          <div className="space-y-3">
            {/* Trio confidence */}
            <div className={`rounded-lg p-4 border ${
              aiResult.trio_confidence === 'strong' ? 'border-primary/20 bg-primary/5' :
              aiResult.trio_confidence === 'risky' ? 'border-destructive/20 bg-destructive/5' :
              'border-border/50 bg-card'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <Badge className={`text-[9px] border-0 ${
                  aiResult.trio_confidence === 'strong' ? 'bg-primary/15 text-primary' :
                  aiResult.trio_confidence === 'acceptable' ? 'bg-secondary text-muted-foreground' :
                  'bg-destructive/15 text-destructive'
                }`}>
                  AI Confidence: {aiResult.trio_confidence}
                </Badge>
                <Button size="sm" className="h-7 text-[10px]" onClick={handleAcceptAiTrio} disabled={acceptingIdx !== null}>
                  {acceptingIdx !== null ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                  Accept trio to future bank
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{aiResult.trio_reasoning}</p>
            </div>

            {/* AI warnings */}
            {aiResult.warnings?.length > 0 && (
              <div className="space-y-1">
                {aiResult.warnings.map((w: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI pairs */}
            {aiResult.pairs?.map((p: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border/50 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display font-bold text-base">{p.word_a} + {p.word_b}</p>
                  <span className="text-sm font-display font-bold text-primary">{p.total_score}/100</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {p.predicted_top_5?.map((a: string, j: number) => (
                    <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full ${
                      j === 0 ? 'bg-primary/15 text-primary font-bold' : 'bg-secondary text-muted-foreground'
                    }`}>{a}</span>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {[
                    { label: 'Consensus', val: p.consensus_strength },
                    { label: 'Frag risk', val: p.fragmentation_risk, invert: true },
                    { label: 'Speed', val: p.fast_comprehension },
                    { label: 'Reveal', val: p.reveal_satisfaction },
                    { label: 'Natural', val: p.naturalness },
                  ].map(({ label, val, invert }) => (
                    <div key={label} className="text-center">
                      <p className={`text-[10px] font-display font-bold ${
                        invert ? (val <= 30 ? 'text-primary' : val >= 60 ? 'text-destructive' : 'text-muted-foreground')
                        : (val >= 70 ? 'text-primary' : val <= 40 ? 'text-destructive' : 'text-muted-foreground')
                      }`}>{val}</p>
                      <p className="text-[8px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">✓ {p.why_jinxable}</p>
                {p.why_might_fail && <p className="text-[10px] text-muted-foreground/60 mt-0.5">⚠ {p.why_might_fail}</p>}
              </motion.div>
            ))}

            {/* Runner-ups */}
            {aiResult.runner_ups?.length > 0 && (
              <div className="bg-card border border-border/50 rounded-lg p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Runner-ups</h3>
                {aiResult.runner_ups.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-t border-border/30 first:border-t-0">
                    <span className="text-[11px] font-display">{r.word_a} + {r.word_b}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-display font-bold text-muted-foreground">{r.total_score}</span>
                      <span className="text-[9px] text-muted-foreground/60 max-w-[200px] truncate">{r.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
