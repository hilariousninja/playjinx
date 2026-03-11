import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getJinxScoreBreakdown, type DbWord } from '@/lib/store';
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

export default function WordDetail({ word, onStatusChange, onNotesChange, onScoreChange }: Props) {
  const metrics = getJinxScoreBreakdown(word);
  const totalWeighted = metrics.reduce((s, m) => s + m.weighted, 0);
  const [notes, setNotes] = useState(word.notes);

  const getStrengthLabel = (score: number) => {
    if (score >= 80) return 'Excellent — highly versatile, clusters well';
    if (score >= 60) return 'Good — solid linkability, decent replay';
    if (score >= 40) return 'Moderate — may produce weak clusters';
    return 'Weak — consider cutting from deck';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="game-card text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{word.category}</p>
        <h2 className="font-display text-3xl font-bold mb-2">{word.word}</h2>
        <div className="flex justify-center gap-2 mb-4">
          {STATUS_OPTIONS.map(opt => (
            <Button key={opt.value} size="sm" variant={word.status === opt.value ? 'default' : 'outline'}
              className={`rounded-xl text-xs ${word.status === opt.value ? opt.cls : ''}`}
              onClick={() => onStatusChange(opt.value)}
            >{opt.label}</Button>
          ))}
        </div>
      </div>

      <div className="game-card text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">JINX Score</p>
        <div className="text-5xl font-display font-bold mb-1">{word.jinx_score}</div>
        <p className="text-xs text-muted-foreground">/100</p>
        <p className="text-sm text-muted-foreground mt-2">{getStrengthLabel(word.jinx_score)}</p>
        <div className="mt-3 flex justify-center gap-2 items-center">
          <span className="text-xs text-muted-foreground">Edit:</span>
          <Input type="number" min={0} max={100} value={word.jinx_score}
            onChange={e => onScoreChange(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-20 h-8 text-center font-display rounded-xl bg-secondary text-sm"
          />
        </div>
      </div>

      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Scoring Breakdown</p>
        <div className="space-y-3">
          {metrics.map(m => (
            <div key={m.name}>
              <div className="flex justify-between text-xs mb-1">
                <span>{m.name}</span>
                <span className="font-display">{m.score}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${m.score}%` }} transition={{ duration: 0.6, delay: 0.1 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="game-card overflow-x-auto">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Weighted Contributions</p>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground">
            <th className="text-left py-1">Metric</th><th className="text-right py-1">Weight</th><th className="text-right py-1">Score</th><th className="text-right py-1">Weighted</th>
          </tr></thead>
          <tbody>
            {metrics.map(m => (
              <tr key={m.name} className="border-t border-border">
                <td className="py-1.5">{m.name}</td>
                <td className="text-right font-display">{(m.weight * 100).toFixed(0)}%</td>
                <td className="text-right font-display">{m.score}</td>
                <td className="text-right font-display font-semibold">{m.weighted}</td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="py-1.5" colSpan={3}>Total</td>
              <td className="text-right font-display">{totalWeighted}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="game-card">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Notes</p>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onNotesChange(notes)}
          placeholder="Why keep or cut this word..." className="rounded-xl bg-secondary border-border resize-none" rows={3}
        />
      </div>
    </motion.div>
  );
}
