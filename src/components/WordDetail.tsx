import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Eye, BarChart3, Hash, Target, Users } from 'lucide-react';
import type { DbWord } from '@/lib/store';
import type { WordStatus } from '@/lib/types';

interface Props {
  word: DbWord;
  onStatusChange: (status: WordStatus) => void;
  onNotesChange: (notes: string) => void;
  onScoreChange: (score: number) => void;
}

const STATUS_OPTIONS: { value: WordStatus; label: string; cls: string }[] = [
  { value: 'keep', label: 'Keep', cls: 'status-keep' },
  { value: 'review', label: 'Review', cls: 'status-review' },
  { value: 'cut', label: 'Cut', cls: 'status-cut' },
  { value: 'unreviewed', label: 'Unreviewed', cls: 'status-unreviewed' },
];

type ConfidenceLevel = 'low' | 'medium' | 'high';

function getConfidence(word: DbWord): ConfidenceLevel {
  const timesUsed = (word as any).times_used ?? 0;
  const totalAppearances = (word.strong_appearances ?? 0) + ((word as any).decent_appearances ?? 0) + (word.weak_appearances ?? 0);
  if (timesUsed < 2 || totalAppearances < 2) return 'low';
  const strongRate = totalAppearances > 0 ? (word.strong_appearances ?? 0) / totalAppearances : 0;
  const weakRate = totalAppearances > 0 ? (word.weak_appearances ?? 0) / totalAppearances : 0;
  if (totalAppearances >= 5 && (strongRate >= 0.7 || weakRate >= 0.7)) return 'high';
  return 'medium';
}

const CONFIDENCE_CONFIG = {
  low: { label: 'Low confidence', desc: 'Not enough data to decide — needs more play time', icon: HelpCircle, cls: 'text-muted-foreground' },
  medium: { label: 'Medium confidence', desc: 'Mixed results — review carefully', icon: Eye, cls: 'text-[hsl(var(--review))]' },
  high: { label: 'High confidence', desc: 'Consistent performance — decision is clear', icon: BarChart3, cls: 'text-[hsl(var(--keep))]' },
};

function getSuggestion(word: DbWord): { text: string; cls: string } {
  const timesUsed = (word as any).times_used ?? 0;
  if (timesUsed === 0) return { text: 'Not enough data — no prompts played with this word yet.', cls: 'text-muted-foreground' };
  const total = (word.strong_appearances ?? 0) + ((word as any).decent_appearances ?? 0) + (word.weak_appearances ?? 0);
  if (total < 2) return { text: 'Not enough data — only appeared in ' + total + ' played prompt(s).', cls: 'text-muted-foreground' };
  const strongRate = (word.strong_appearances ?? 0) / total;
  const weakRate = (word.weak_appearances ?? 0) / total;
  if (strongRate >= 0.6) return { text: 'This word is proving itself — strong convergence in most prompts.', cls: 'text-[hsl(var(--keep))]' };
  if (weakRate >= 0.6) return { text: 'This word is underperforming — scattered answers in most prompts.', cls: 'text-destructive' };
  return { text: 'Mixed results — some prompts worked, some didn\'t. Consider pairing context.', cls: 'text-[hsl(var(--review))]' };
}

export default function WordDetail({ word, onStatusChange, onNotesChange, onScoreChange }: Props) {
  const [notes, setNotes] = useState(word.notes);
  const confidence = getConfidence(word);
  const confConfig = CONFIDENCE_CONFIG[confidence];
  const suggestion = getSuggestion(word);

  const timesUsed = (word as any).times_used ?? 0;
  const strongApp = word.strong_appearances ?? 0;
  const decentApp = (word as any).decent_appearances ?? 0;
  const weakApp = word.weak_appearances ?? 0;
  const totalApp = strongApp + decentApp + weakApp;
  const avgTopPct = (word as any).avg_top_answer_pct ?? 0;
  const avgUnique = (word as any).avg_unique_answers ?? 0;
  const strongRate = totalApp > 0 ? Math.round((strongApp / totalApp) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Word header + status */}
      <div className="game-card text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{word.category}</p>
        <h2 className="font-display text-3xl font-bold mb-2">{word.word}</h2>
        <div className="flex justify-center gap-2 mb-3">
          {STATUS_OPTIONS.map(opt => (
            <Button key={opt.value} size="sm" variant={word.status === opt.value ? 'default' : 'outline'}
              className={`rounded-xl text-xs ${word.status === opt.value ? opt.cls : ''}`}
              onClick={() => onStatusChange(opt.value)}
            >{opt.label}</Button>
          ))}
        </div>
      </div>

      {/* Suggestion */}
      <div className="game-card">
        <p className={`text-sm font-medium ${suggestion.cls}`}>{suggestion.text}</p>
      </div>

      {/* Confidence Indicator */}
      <div className="game-card">
        <div className="flex items-center gap-2 mb-1">
          <confConfig.icon className={`h-4 w-4 ${confConfig.cls}`} />
          <span className={`text-sm font-semibold ${confConfig.cls}`}>{confConfig.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">{confConfig.desc}</p>
      </div>

      {/* Usage stats */}
      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Usage & Performance</p>
        {timesUsed === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Not enough data — this word hasn't appeared in any played prompts yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Hash className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-display font-bold">{timesUsed}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Times used</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Target className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-display font-bold">{avgTopPct}%</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg top %</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-display font-bold">{avgUnique}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg unique</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-secondary rounded-xl p-3 text-center">
                <TrendingUp className="h-3.5 w-3.5 mx-auto mb-1 text-[hsl(var(--keep))]" />
                <p className="text-lg font-display font-bold">{strongApp}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Strong</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Minus className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-display font-bold">{decentApp}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Decent</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <TrendingDown className="h-3.5 w-3.5 mx-auto mb-1 text-[hsl(var(--cut))]" />
                <p className="text-lg font-display font-bold">{weakApp}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Weak</p>
              </div>
            </div>

            {totalApp > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Strong rate</span>
                  <span className="font-display font-bold">{strongRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${strongRate >= 60 ? 'bg-[hsl(var(--keep))]' : strongRate >= 40 ? 'bg-[hsl(var(--review))]' : 'bg-[hsl(var(--cut))]'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${strongRate}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Data-driven score */}
      <div className="game-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">JINX Score</p>
            <p className="text-[10px] text-muted-foreground">
              {timesUsed >= 2 ? 'Computed from play data' : 'Not enough data — default score'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-display text-xl font-bold ${timesUsed < 2 ? 'text-muted-foreground' : ''}`}>
              {timesUsed < 2 ? '—' : word.jinx_score}
            </span>
            {timesUsed >= 2 && <span className="text-xs text-muted-foreground">/100</span>}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Notes</p>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onNotesChange(notes)}
          placeholder="Why keep or cut this word…" className="rounded-xl bg-secondary border-border resize-none" rows={3}
        />
      </div>
    </motion.div>
  );
}
