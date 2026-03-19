import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown, HelpCircle, Eye, BarChart3 } from 'lucide-react';
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
  const totalAppearances = (word.strong_appearances ?? 0) + (word.weak_appearances ?? 0);
  if (totalAppearances < 2) return 'low';
  const strongRate = totalAppearances > 0 ? (word.strong_appearances ?? 0) / totalAppearances : 0;
  if (totalAppearances >= 5 && (strongRate >= 0.7 || strongRate <= 0.3)) return 'high';
  return 'medium';
}

const CONFIDENCE_CONFIG = {
  low: { label: 'Low confidence', desc: 'Not enough data to decide — needs more play time', icon: HelpCircle, cls: 'text-muted-foreground' },
  medium: { label: 'Medium confidence', desc: 'Mixed results — review carefully', icon: Eye, cls: 'text-[hsl(var(--review))]' },
  high: { label: 'High confidence', desc: 'Consistent performance — decision is clear', icon: BarChart3, cls: 'text-[hsl(var(--keep))]' },
};

export default function WordDetail({ word, onStatusChange, onNotesChange, onScoreChange }: Props) {
  const [notes, setNotes] = useState(word.notes);
  const confidence = getConfidence(word);
  const confConfig = CONFIDENCE_CONFIG[confidence];
  const totalAppearances = (word.strong_appearances ?? 0) + (word.weak_appearances ?? 0);
  const strongRate = totalAppearances > 0 ? Math.round(((word.strong_appearances ?? 0) / totalAppearances) * 100) : 0;

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

      {/* Confidence Indicator */}
      <div className="game-card">
        <div className="flex items-center gap-2 mb-1">
          <confConfig.icon className={`h-4 w-4 ${confConfig.cls}`} />
          <span className={`text-sm font-semibold ${confConfig.cls}`}>{confConfig.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">{confConfig.desc}</p>
      </div>

      {/* Evidence signals */}
      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Performance Evidence</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <TrendingUp className="h-3.5 w-3.5 mx-auto mb-1 text-[hsl(var(--keep))]" />
            <p className="text-lg font-display font-bold">{word.strong_appearances ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Strong appearances</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <TrendingDown className="h-3.5 w-3.5 mx-auto mb-1 text-[hsl(var(--cut))]" />
            <p className="text-lg font-display font-bold">{word.weak_appearances ?? 0}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Weak appearances</p>
          </div>
        </div>
        {totalAppearances > 0 && (
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
        {totalAppearances === 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-3">No play data yet — this word hasn't appeared in prompts.</p>
        )}
      </div>

      {/* Score (secondary, de-emphasised) */}
      <div className="game-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">JINX Score</p>
            <p className="text-[10px] text-muted-foreground">Manual rating — one input, not the full picture</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={word.jinx_score}
              onChange={e => onScoreChange(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-16 h-8 text-center font-display rounded-xl bg-secondary text-sm"
            />
            <span className="text-xs text-muted-foreground">/100</span>
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
