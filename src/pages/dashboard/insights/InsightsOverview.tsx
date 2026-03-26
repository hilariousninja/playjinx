import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart3, Users, Target, Zap } from 'lucide-react';
import { PromptRow, ScoredWord } from './word-scoring';

interface Props {
  prompts: PromptRow[];
  scoredWords: ScoredWord[];
  stats: { totalPlayers: number; avgTopPct: number; playedCount: number };
}

export default function InsightsOverview({ prompts, scoredWords, stats }: Props) {
  const insights = useMemo(() => {
    const strongest = [...prompts].filter(p => p.performance === 'strong')
      .sort((a, b) => b.top_answer_pct - a.top_answer_pct).slice(0, 5);
    const weakest = [...prompts].filter(p => p.performance === 'weak')
      .sort((a, b) => a.top_answer_pct - b.top_answer_pct).slice(0, 5);
    const mostFragmented = [...prompts].sort((a, b) => {
      const rA = a.total_players > 0 ? a.unique_answers / a.total_players : 0;
      const rB = b.total_players > 0 ? b.unique_answers / b.total_players : 0;
      return rB - rA;
    }).slice(0, 5);

    const starWords = scoredWords.filter(w => w.times_used >= 3 && w.strong_appearances >= 3 && w.strong_appearances > w.weak_appearances).slice(0, 5);
    const troubleWords = scoredWords.filter(w => w.times_used >= 3 && w.weak_appearances >= 3 && w.weak_appearances > w.strong_appearances).slice(0, 5);

    return { strongest, weakest, mostFragmented, starWords, troubleWords };
  }, [prompts, scoredWords]);

  if (stats.playedCount === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <BarChart3 className="h-6 w-6 mx-auto mb-2" />
        <p className="text-sm font-semibold">No play data yet</p>
        <p className="text-xs mt-1">Insights will appear after prompts have been played.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Users} value={stats.totalPlayers} label="Total plays" />
        <StatCard icon={Zap} value={stats.playedCount} label="Played prompts" />
        <StatCard icon={Target} value={`${stats.avgTopPct}%`} label="Avg top answer" />
      </div>

      {insights.strongest.length > 0 && (
        <PromptList title="Strongest prompts" icon={TrendingUp} iconCls="text-[hsl(var(--keep))]"
          items={insights.strongest} cls="text-[hsl(var(--keep))]" />
      )}
      {insights.weakest.length > 0 && (
        <PromptList title="Weakest prompts" icon={TrendingDown} iconCls="text-destructive"
          items={insights.weakest} cls="text-destructive" />
      )}
      {insights.mostFragmented.length > 0 && (
        <PromptList title="Most fragmented" icon={BarChart3} iconCls="text-[hsl(var(--review))]"
          items={insights.mostFragmented} cls="text-[hsl(var(--review))]"
          metaFn={p => {
            const ratio = p.total_players > 0 ? Math.round((p.unique_answers / p.total_players) * 100) : 0;
            return `${ratio}% unique · ${p.total_players}p`;
          }}
        />
      )}

      {/* Star words */}
      {insights.starWords.length > 0 && (
        <WordChips title="Star words" icon={TrendingUp} iconCls="text-[hsl(var(--keep))]"
          words={insights.starWords.map(w => ({ word: w.word, badge: `${w.strong_appearances}s` }))}
          chipCls="bg-primary/10 text-primary" />
      )}
      {insights.troubleWords.length > 0 && (
        <WordChips title="Trouble words" icon={TrendingDown} iconCls="text-destructive"
          words={insights.troubleWords.map(w => ({ word: w.word, badge: `${w.weak_appearances}w` }))}
          chipCls="bg-destructive/10 text-destructive" />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Users; value: string | number; label: string }) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-lg font-display font-bold">{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function PromptList({ title, icon: Icon, iconCls, items, cls, metaFn }: {
  title: string; icon: typeof TrendingUp; iconCls: string;
  items: PromptRow[]; cls: string;
  metaFn?: (p: PromptRow) => string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-1">
        {items.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="bg-card border border-border/50 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <span className="font-display text-sm font-bold">{p.word_a} + {p.word_b}</span>
            <span className={`text-[10px] font-display ${cls}`}>
              {metaFn ? metaFn(p) : `${p.total_players}p · Top ${p.top_answer_pct}%`}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WordChips({ title, icon: Icon, iconCls, words, chipCls }: {
  title: string; icon: typeof TrendingUp; iconCls: string;
  words: { word: string; badge: string }[]; chipCls: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map(w => (
          <span key={w.word} className={`text-[11px] font-display font-bold px-2.5 py-1 rounded-lg ${chipCls}`}>
            {w.word} <span className="text-[9px] font-normal opacity-60">{w.badge}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
