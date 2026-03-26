import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { PromptRow } from './word-scoring';

interface Props {
  prompts: PromptRow[];
}

type SortKey = 'date' | 'total_players' | 'top_answer_pct' | 'fragmentation';
type SortDir = 'asc' | 'desc';

export default function InsightsPrompts({ prompts }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; count: number; pct: number }[]>>({});

  const filtered = useMemo(() => {
    let list = [...prompts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.word_a.toLowerCase().includes(q) || p.word_b.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'fragmentation') {
        va = a.total_players > 0 ? a.unique_answers / a.total_players : 0;
        vb = b.total_players > 0 ? b.unique_answers / b.total_players : 0;
      } else if (sortKey === 'date') {
        va = new Date(a.date).getTime();
        vb = new Date(b.date).getTime();
      } else {
        va = a[sortKey]; vb = b[sortKey];
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [prompts, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!answers[id]) {
      const { data } = await supabase.from('answers')
        .select('normalized_answer')
        .eq('prompt_id', id);
      if (data) {
        const counts = new Map<string, number>();
        data.forEach(a => counts.set(a.normalized_answer, (counts.get(a.normalized_answer) || 0) + 1));
        const total = data.length;
        const sorted = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([answer, count]) => ({ answer, count, pct: Math.round((count / total) * 100) }));
        setAnswers(prev => ({ ...prev, [id]: sorted }));
      }
    }
  };

  const perfColor = (p: string | null) => {
    if (p === 'strong') return 'text-[hsl(var(--keep))]';
    if (p === 'weak') return 'text-destructive';
    return 'text-[hsl(var(--review))]';
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search word pairs…" value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 h-8 text-xs" />
      </div>

      <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold px-3">
        <button onClick={() => toggleSort('date')} className="text-left">Date <SortIcon k="date" /></button>
        <button onClick={() => toggleSort('total_players')} className="text-right">Players <SortIcon k="total_players" /></button>
        <button onClick={() => toggleSort('top_answer_pct')} className="text-right">Top % <SortIcon k="top_answer_pct" /></button>
        <button onClick={() => toggleSort('fragmentation')} className="text-right">Frag <SortIcon k="fragmentation" /></button>
        <span className="text-right">Perf</span>
      </div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.map(p => {
          const frag = p.total_players > 0 ? Math.round((p.unique_answers / p.total_players) * 100) : 0;
          const isExpanded = expandedId === p.id;
          return (
            <div key={p.id}>
              <button onClick={() => toggleExpand(p.id)}
                className="w-full grid grid-cols-[1fr_60px_60px_60px_60px] gap-1 bg-card border border-border/50 rounded-lg px-3 py-2 items-center hover:bg-accent/30 transition-colors">
                <div className="text-left">
                  <span className="font-display text-sm font-bold">{p.word_a} + {p.word_b}</span>
                  <span className="text-[9px] text-muted-foreground ml-2">{p.date}</span>
                </div>
                <span className="text-right text-xs tabular-nums">{p.total_players}</span>
                <span className="text-right text-xs tabular-nums">{p.top_answer_pct}%</span>
                <span className="text-right text-xs tabular-nums">{frag}%</span>
                <span className={`text-right text-[10px] font-semibold capitalize ${perfColor(p.performance)}`}>
                  {p.performance || '—'}
                </span>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="bg-muted/30 border border-border/30 rounded-lg mx-2 mt-1 p-3">
                      {!answers[p.id] ? (
                        <p className="text-xs text-muted-foreground">Loading answers…</p>
                      ) : answers[p.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">No answers recorded</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Answer distribution</p>
                          {answers[p.id].slice(0, 10).map((a, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="flex-1 bg-border/30 rounded-full h-4 overflow-hidden">
                                <div className="bg-primary/60 h-full rounded-full transition-all"
                                  style={{ width: `${a.pct}%` }} />
                              </div>
                              <span className="text-xs font-display font-bold w-24 truncate">{a.answer}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-16 text-right">{a.count} ({a.pct}%)</span>
                            </div>
                          ))}
                          {answers[p.id].length > 10 && (
                            <p className="text-[9px] text-muted-foreground">+{answers[p.id].length - 10} more answers</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-2 italic">
                            {p.performance === 'strong' ? 'Strong convergence — players consistently agreed on answers.' :
                              p.performance === 'weak' ? 'High fragmentation — answers were spread too thin.' :
                                'Moderate convergence — some agreement but notable spread.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No prompts match your search.</p>
      )}
    </div>
  );
}
