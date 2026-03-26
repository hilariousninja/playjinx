import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScoredWord } from './word-scoring';

interface Props {
  word: ScoredWord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WordDetailDialog({ word, open, onOpenChange }: Props) {
  const [answersByPrompt, setAnswersByPrompt] = useState<Record<string, { answer: string; count: number; pct: number }[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!word || !open || word.promptPairings.length === 0) return;
    setLoading(true);
    const ids = word.promptPairings.map(p => p.id);
    (async () => {
      const { data } = await supabase.from('answers')
        .select('prompt_id, normalized_answer')
        .in('prompt_id', ids);
      if (data) {
        const map: Record<string, Map<string, number>> = {};
        data.forEach(a => {
          if (!map[a.prompt_id]) map[a.prompt_id] = new Map();
          map[a.prompt_id].set(a.normalized_answer, (map[a.prompt_id].get(a.normalized_answer) || 0) + 1);
        });
        const result: Record<string, { answer: string; count: number; pct: number }[]> = {};
        Object.entries(map).forEach(([pid, counts]) => {
          const total = [...counts.values()].reduce((s, v) => s + v, 0);
          result[pid] = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([answer, count]) => ({ answer, count, pct: Math.round((count / total) * 100) }));
        });
        setAnswersByPrompt(result);
      }
      setLoading(false);
    })();
  }, [word, open]);

  if (!word) return null;

  const best = [...word.promptPairings].sort((a, b) => b.top_answer_pct - a.top_answer_pct);
  const worst = [...word.promptPairings].sort((a, b) => a.top_answer_pct - b.top_answer_pct);

  const recColor = {
    keep: 'text-[hsl(var(--keep))] bg-[hsl(var(--keep))]/10',
    watch: 'text-[hsl(var(--review))] bg-[hsl(var(--review))]/10',
    cut: 'text-destructive bg-destructive/10',
    add: 'text-primary bg-primary/10',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{word.word}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-lg font-bold">{word.strengthScore}</p>
              <p className="text-[9px] text-muted-foreground uppercase">Score</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${recColor[word.recommendation]}`}>
                {word.recommendation}
              </span>
              <p className="text-[9px] text-muted-foreground uppercase mt-1">Recommendation</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-lg font-bold">{word.times_used}</p>
              <p className="text-[9px] text-muted-foreground uppercase">Appearances</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">{word.explanation}</p>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>Category: <span className="font-semibold">{word.category}</span></div>
            <div>Core deck: <span className="font-semibold">{word.in_core_deck ? 'Yes' : 'No'}</span></div>
            <div>Strong: <span className="font-semibold text-[hsl(var(--keep))]">{word.strong_appearances}</span></div>
            <div>Weak: <span className="font-semibold text-destructive">{word.weak_appearances}</span></div>
            <div>Avg top %: <span className="font-semibold">{Math.round(word.avg_top_answer_pct)}%</span></div>
            <div>Confidence: <span className="font-semibold capitalize">{word.confidence}</span></div>
          </div>

          {/* Best pairings */}
          {best.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="h-3 w-3 text-[hsl(var(--keep))]" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Best pairings</span>
              </div>
              {best.slice(0, 5).map(p => {
                const partner = p.word_a.toLowerCase() === word.word.toLowerCase() ? p.word_b : p.word_a;
                return (
                  <div key={p.id} className="bg-card border border-border/30 rounded px-3 py-2 mb-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-display font-bold">+ {partner}</span>
                      <span className="text-[10px] text-[hsl(var(--keep))]">{p.top_answer_pct}% · {p.total_players}p</span>
                    </div>
                    {answersByPrompt[p.id] && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {answersByPrompt[p.id].map((a, i) => (
                          <span key={i} className="text-[9px] bg-muted rounded px-1.5 py-0.5">
                            {a.answer} ({a.pct}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Worst pairings */}
          {worst.length > 1 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown className="h-3 w-3 text-destructive" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Weakest pairings</span>
              </div>
              {worst.slice(0, 3).map(p => {
                const partner = p.word_a.toLowerCase() === word.word.toLowerCase() ? p.word_b : p.word_a;
                return (
                  <div key={p.id} className="bg-card border border-border/30 rounded px-3 py-2 mb-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-display font-bold">+ {partner}</span>
                      <span className="text-[10px] text-destructive">{p.top_answer_pct}% · {p.total_players}p</span>
                    </div>
                    {answersByPrompt[p.id] && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {answersByPrompt[p.id].map((a, i) => (
                          <span key={i} className="text-[9px] bg-muted rounded px-1.5 py-0.5">
                            {a.answer} ({a.pct}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {loading && <p className="text-xs text-muted-foreground">Loading answer data…</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
