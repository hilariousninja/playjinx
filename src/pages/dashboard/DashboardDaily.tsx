import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Loader2, RefreshCw, TrendingUp, TrendingDown, Gauge, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export default function DashboardDaily() {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

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
    const confirmed = confirm('Force regenerate today\'s daily set? This will deactivate the current set and pick a new trio.');
    if (!confirmed) return;
    setRegenerating(true);
    try {
      // Deactivate current
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('prompts').update({ active: false, mode: 'archive' }).eq('active', true).eq('date', today);
      // Generate new
      const { data } = await supabase.functions.invoke('generate-daily-prompts');
      if (data) setAuditData(data);
      else await loadAudit();
    } catch (e) {
      console.error('Regenerate failed', e);
      alert('Regeneration failed.');
    }
    setRegenerating(false);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Daily Sets</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={loadAudit}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
            Regenerate
          </Button>
        </div>
      </div>

      {auditData && (
        <>
          {/* Confidence summary */}
          <div className={`rounded-xl p-4 border ${
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
            {auditData.prompts?.map((p: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border/50 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display font-bold text-base">{p.pair}</p>
                  <div className="flex items-center gap-2">
                    {p.tag && <Badge className={`text-[9px] border-0 ${p.tag === 'safe' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>{p.tag}</Badge>}
                    {p.performance && (
                      <span className={`text-[10px] font-display font-bold ${
                        p.performance === 'strong' ? 'text-[hsl(var(--keep))]' :
                        p.performance === 'weak' ? 'text-destructive' : 'text-muted-foreground'
                      }`}>{p.performance}</span>
                    )}
                  </div>
                </div>
                {p.total_players > 0 ? (
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>{p.total_players} players</span>
                    <span>{p.unique_answers} unique</span>
                    <span>Top: {p.top_answer_pct}%</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">Unplayed — no history</p>
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
            ))}
          </div>

          {/* Score breakdown */}
          {auditData.score_breakdown && (
            <div className="bg-card border border-border/50 rounded-xl p-4">
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
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Runner-up Trios <span className="text-foreground/40">({auditData.candidates_sampled} sampled)</span>
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
    </div>
  );
}
