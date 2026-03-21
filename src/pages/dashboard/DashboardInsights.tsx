import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Loader2, BarChart3, Users, Target, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PromptRow {
  id: string;
  word_a: string;
  word_b: string;
  total_players: number;
  unique_answers: number;
  top_answer_pct: number;
  performance: string | null;
  prompt_tag: string | null;
  date: string;
}

interface WordRow {
  word: string;
  times_used: number;
  strong_appearances: number;
  decent_appearances: number;
  weak_appearances: number;
  status: string;
}

export default function DashboardInsights() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [words, setWords] = useState<WordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pRes, wRes] = await Promise.all([
        supabase.from('prompts').select('id, word_a, word_b, total_players, unique_answers, top_answer_pct, performance, prompt_tag, date')
          .gt('total_players', 0).order('total_players', { ascending: false }),
        supabase.from('words').select('word, times_used, strong_appearances, decent_appearances, weak_appearances, status')
          .gt('times_used', 0).order('times_used', { ascending: false }),
      ]);
      setPrompts((pRes.data ?? []) as PromptRow[]);
      setWords((wRes.data ?? []) as WordRow[]);
      setLoading(false);
    })();
  }, []);

  const insights = useMemo(() => {
    const played = prompts.filter(p => p.total_players > 0);
    const strongest = played.filter(p => p.performance === 'strong').sort((a, b) => b.top_answer_pct - a.top_answer_pct).slice(0, 5);
    const weakest = played.filter(p => p.performance === 'weak').sort((a, b) => a.top_answer_pct - b.top_answer_pct).slice(0, 5);
    const mostFragmented = [...played].sort((a, b) => {
      const rA = a.total_players > 0 ? a.unique_answers / a.total_players : 0;
      const rB = b.total_players > 0 ? b.unique_answers / b.total_players : 0;
      return rB - rA;
    }).slice(0, 5);
    const strongestConvergence = [...played].sort((a, b) => b.top_answer_pct - a.top_answer_pct).slice(0, 5);
    
    const totalPlayers = played.reduce((s, p) => s + p.total_players, 0);
    const avgTopPct = played.length > 0 ? Math.round(played.reduce((s, p) => s + p.top_answer_pct, 0) / played.length) : 0;

    // Words that repeatedly create good/bad prompts
    const starWords = words.filter(w => w.strong_appearances >= 3 && w.strong_appearances > w.weak_appearances).slice(0, 5);
    const troubleWords = words.filter(w => w.weak_appearances >= 3 && w.weak_appearances > w.strong_appearances).slice(0, 5);

    return { played, strongest, weakest, mostFragmented, strongestConvergence, totalPlayers, avgTopPct, starWords, troubleWords };
  }, [prompts, words]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold">Insights</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border/50 rounded-lg p-3 text-center">
          <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-display font-bold">{insights.totalPlayers}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total plays</p>
        </div>
        <div className="bg-card border border-border/50 rounded-lg p-3 text-center">
          <Zap className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-display font-bold">{insights.played.length}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Prompts played</p>
        </div>
        <div className="bg-card border border-border/50 rounded-lg p-3 text-center">
          <Target className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-display font-bold">{insights.avgTopPct}%</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg top answer</p>
        </div>
      </div>

      {/* Strongest prompts */}
      {insights.strongest.length > 0 && (
        <InsightSection title="Strongest prompts" icon={TrendingUp} iconCls="text-[hsl(var(--keep))]"
          items={insights.strongest} renderItem={p => ({
            label: `${p.word_a} + ${p.word_b}`,
            meta: `${p.total_players}p · Top ${p.top_answer_pct}%`,
            cls: 'text-[hsl(var(--keep))]',
          })}
        />
      )}

      {/* Weakest prompts */}
      {insights.weakest.length > 0 && (
        <InsightSection title="Weakest prompts" icon={TrendingDown} iconCls="text-destructive"
          items={insights.weakest} renderItem={p => ({
            label: `${p.word_a} + ${p.word_b}`,
            meta: `${p.total_players}p · Top ${p.top_answer_pct}%`,
            cls: 'text-destructive',
          })}
        />
      )}

      {/* Highest fragmentation */}
      {insights.mostFragmented.length > 0 && (
        <InsightSection title="Most fragmented" icon={BarChart3} iconCls="text-[hsl(var(--review))]"
          items={insights.mostFragmented} renderItem={p => {
            const ratio = p.total_players > 0 ? Math.round((p.unique_answers / p.total_players) * 100) : 0;
            return {
              label: `${p.word_a} + ${p.word_b}`,
              meta: `${ratio}% unique · ${p.total_players}p`,
              cls: 'text-[hsl(var(--review))]',
            };
          }}
        />
      )}

      {/* Strongest convergence */}
      {insights.strongestConvergence.length > 0 && (
        <InsightSection title="Strongest convergence" icon={Target} iconCls="text-primary"
          items={insights.strongestConvergence} renderItem={p => ({
            label: `${p.word_a} + ${p.word_b}`,
            meta: `Top ${p.top_answer_pct}% · ${p.total_players}p`,
            cls: 'text-primary',
          })}
        />
      )}

      {/* Star words */}
      {insights.starWords.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--keep))]" />
            <span className="text-xs font-semibold text-muted-foreground">Star words</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insights.starWords.map(w => (
              <span key={w.word} className="text-[11px] font-display font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                {w.word} <span className="text-[9px] font-normal opacity-60">{w.strong_appearances}s</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trouble words */}
      {insights.troubleWords.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-semibold text-muted-foreground">Trouble words</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insights.troubleWords.map(w => (
              <span key={w.word} className="text-[11px] font-display font-bold bg-destructive/10 text-destructive px-2.5 py-1 rounded-lg">
                {w.word} <span className="text-[9px] font-normal opacity-60">{w.weak_appearances}w</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {insights.played.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <BarChart3 className="h-6 w-6 mx-auto mb-2" />
          <p className="text-sm font-semibold">No play data yet</p>
          <p className="text-xs mt-1">Insights will appear after prompts have been played.</p>
        </div>
      )}
    </div>
  );
}

function InsightSection<T>({ title, icon: Icon, iconCls, items, renderItem }: {
  title: string;
  icon: typeof TrendingUp;
  iconCls: string;
  items: T[];
  renderItem: (item: T) => { label: string; meta: string; cls: string };
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => {
          const { label, meta, cls } = renderItem(item);
          return (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="bg-card border border-border/50 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="font-display text-sm font-bold">{label}</span>
              <span className={`text-[10px] font-display ${cls}`}>{meta}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
