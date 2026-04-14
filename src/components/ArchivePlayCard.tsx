import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { submitAnswer, getStats, getCanonicalAnswer, markPromptCompleted, type DbPrompt, type DbAnswer, type AnswerStat } from '@/lib/store';
import { validateInput } from '@/lib/normalize';

interface PromptSummary {
  prompt: DbPrompt;
  answer: DbAnswer | null;
  stats: AnswerStat[];
  total: number;
  rank: number;
  matchCount: number;
  percentage: number;
  userCanonical: string | null;
}

interface Props {
  summary: PromptSummary;
  isToday: boolean;
  onAnswered: (updated: PromptSummary) => void;
  onSeeAll: (s: PromptSummary) => void;
}

export default function ArchivePlayCard({ summary: s, isToday, onAnswered, onSeeAll }: Props) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justAnswered, setJustAnswered] = useState(false);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    const validationError = validateInput(trimmed);
    if (validationError) { setError(validationError); return; }
    if (submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const answer = await submitAnswer(s.prompt.id, trimmed);
      markPromptCompleted(s.prompt.id);

      // Load stats for the just-answered prompt
      const stats = await getStats(s.prompt.id);
      const total = s.prompt.total_players || stats.reduce((a, st) => a + st.count, 0);
      const canon = await getCanonicalAnswer(answer.normalized_answer);
      let userStat = stats.find(st => st.normalized_answer === canon);
      if (!userStat) {
        const { levenshtein } = await import('@/lib/normalize');
        userStat = stats.find(st => {
          const dist = levenshtein(canon, st.normalized_answer);
          return st.normalized_answer.length > 3 && dist <= (st.normalized_answer.length >= 10 ? 2 : 1);
        });
      }

      const updated: PromptSummary = {
        ...s,
        answer,
        stats,
        total,
        rank: userStat?.rank ?? 0,
        matchCount: userStat?.count ?? 0,
        percentage: userStat?.percentage ?? 0,
        userCanonical: userStat?.normalized_answer ?? canon,
      };

      setJustAnswered(true);
      onAnswered(updated);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnswer = s.answer || justAnswered;

  // Answered state — show result with bar
  if (hasAnswer && s.answer) {
    const barWidth = s.total > 0 && s.matchCount > 0
      ? Math.max(Math.round((s.matchCount / s.total) * 100), 4) : 0;
    const rnkCls = s.rank === 1 ? 'bg-[hsl(var(--success))]/10 text-[hsl(142_72%_30%)]'
      : s.rank === 2 ? 'bg-primary/10 text-[hsl(var(--warning-foreground))]'
      : 'bg-muted text-muted-foreground';

    return (
      <div className="bg-card rounded-[13px] border border-foreground/[0.08] p-[13px]">
        <div className="flex items-center justify-between mb-[6px]">
          <span className="text-[14px] font-bold text-foreground">
            {s.prompt.word_a} <span className="text-primary font-normal mx-1">+</span> {s.prompt.word_b}
          </span>
          {s.rank > 0 && (
            <span className={`text-[10px] font-semibold px-[6px] py-[2px] rounded-[6px] ${rnkCls}`}>
              #{s.rank}
            </span>
          )}
        </div>

        <div className="flex items-center gap-[6px] mb-[7px]">
          <span className="text-[17px] font-bold text-foreground">{s.answer.raw_answer}</span>
          <span className="text-[9px] font-semibold bg-primary text-white px-[5px] py-[2px] rounded">you</span>
          <div className="flex-1 bg-muted/40 rounded h-4 overflow-hidden ml-1">
            <div className="h-full rounded" style={{
              width: `${barWidth}%`,
              background: s.rank === 1 ? 'hsl(var(--success) / 0.12)' : s.rank === 2 ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--foreground) / 0.06)',
            }} />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.percentage}%</span>
        </div>

        {justAnswered && (
          <p className="text-[10px] text-muted-foreground/60 italic mb-[4px]">Late play · added to your history</p>
        )}

        <button
          onClick={() => onSeeAll(s)}
          className="w-full bg-transparent border-none border-t border-foreground/[0.08] pt-[7px] text-[11px] text-primary font-medium cursor-pointer text-left flex items-center justify-between"
        >
          <span>See all answers</span>
          <span>→</span>
        </button>
      </div>
    );
  }

  // Unanswered state — inline play input
  return (
    <div className="bg-card rounded-[13px] border border-primary/20 p-[13px]">
      <div className="flex items-center justify-between mb-[6px]">
        <span className="text-[14px] font-bold text-foreground">
          {s.prompt.word_a} <span className="text-primary font-normal mx-1">+</span> {s.prompt.word_b}
        </span>
        {!isToday && (
          <span className="text-[9px] font-semibold px-[6px] py-[2px] rounded-full bg-primary/8 text-primary">Late play</span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mb-[8px]">
        {isToday ? 'Answer to see how the crowd played it' : 'Play this one to unlock crowd results'}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 border-b-[1.5px] border-primary/40 pb-[3px]">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Your linking word"
            className="bg-transparent text-[15px] font-semibold text-primary placeholder:text-primary/25 placeholder:font-normal focus:outline-none w-full"
            maxLength={80}
            disabled={submitting}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          className="text-[12px] font-semibold text-white bg-primary px-[10px] py-[5px] rounded-[8px] disabled:opacity-40 cursor-pointer shrink-0"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit'}
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
