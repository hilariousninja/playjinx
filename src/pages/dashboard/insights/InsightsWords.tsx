import { useState, useMemo, useCallback } from 'react';
import { Search, ArrowUpDown, Download, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScoredWord, Recommendation } from './word-scoring';
import WordDetailDialog from './WordDetailDialog';

interface Props {
  scoredWords: ScoredWord[];
  refreshWord: (id: string) => Promise<void>;
}

type SortKey = 'word' | 'strengthScore' | 'times_used' | 'avg_top_answer_pct' | 'strong_appearances' | 'weak_appearances' | 'recommendation';
type SortDir = 'asc' | 'desc';

const REC_ORDER: Record<Recommendation, number> = { keep: 0, add: 1, watch: 2, cut: 3 };
const OVERRIDES = [
  { value: '', label: 'Auto' },
  { value: 'locked_keep', label: '🔒 Keep' },
  { value: 'locked_cut', label: '🔒 Cut' },
  { value: 'test_more', label: '🧪 Test more' },
  { value: 'designer_favourite', label: '⭐ Favourite' },
];

const recBadge: Record<Recommendation, string> = {
  keep: 'bg-[hsl(var(--keep))]/10 text-[hsl(var(--keep))]',
  watch: 'bg-[hsl(var(--review))]/10 text-[hsl(var(--review))]',
  cut: 'bg-destructive/10 text-destructive',
  add: 'bg-primary/10 text-primary',
};

export default function InsightsWords({ scoredWords, refreshWord }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('strengthScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterRec, setFilterRec] = useState<Recommendation | 'all'>('all');
  const [filterDeck, setFilterDeck] = useState<'all' | 'core' | 'non-core'>('all');
  const [selectedWord, setSelectedWord] = useState<ScoredWord | null>(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const filtered = useMemo(() => {
    let list = [...scoredWords];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w => w.word.toLowerCase().includes(q) || w.category.toLowerCase().includes(q));
    }
    if (filterRec !== 'all') list = list.filter(w => w.recommendation === filterRec);
    if (filterDeck === 'core') list = list.filter(w => w.in_core_deck);
    if (filterDeck === 'non-core') list = list.filter(w => !w.in_core_deck);

    list.sort((a, b) => {
      if (sortKey === 'recommendation') {
        const diff = REC_ORDER[a.recommendation] - REC_ORDER[b.recommendation];
        return sortDir === 'asc' ? diff : -diff;
      }
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [scoredWords, search, sortKey, sortDir, filterRec, filterDeck]);

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleCoreDeck = useCallback(async (word: ScoredWord) => {
    const newVal = !word.in_core_deck;
    await supabase.from('words').update({ in_core_deck: newVal } as any).eq('id', word.id);
    await refreshWord(word.id);
    toast.success(`${word.word} ${newVal ? 'added to' : 'removed from'} core deck`);
  }, [refreshWord]);

  const setOverride = useCallback(async (word: ScoredWord, override: string) => {
    await supabase.from('words').update({ deck_override: override || null } as any).eq('id', word.id);
    await refreshWord(word.id);
    toast.success(`Override updated for ${word.word}`);
  }, [refreshWord]);

  // Computed summaries
  const deckSummary = useMemo(() => {
    const core = scoredWords.filter(w => w.in_core_deck);
    const cutCandidates = core.filter(w => w.recommendation === 'cut' && !w.deck_override?.startsWith('locked'));
    const addCandidates = scoredWords.filter(w => !w.in_core_deck && w.recommendation === 'add');
    const categories = new Map<string, { count: number; avgScore: number }>();
    core.forEach(w => {
      const cat = w.category || 'Uncategorized';
      const entry = categories.get(cat) || { count: 0, avgScore: 0 };
      entry.count++;
      entry.avgScore += w.strengthScore;
      categories.set(cat, entry);
    });
    categories.forEach((v) => { v.avgScore = Math.round(v.avgScore / v.count); });
    const catHealth = [...categories.entries()]
      .map(([cat, { count, avgScore }]) => ({ cat, count, avgScore }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const concreteCount = core.filter(w => w.category && !['concepts', 'emotions', 'abstract'].some(c => w.category.toLowerCase().includes(c))).length;
    const abstractCount = core.length - concreteCount;

    return { coreSize: core.length, cutCandidates, addCandidates, catHealth, concreteCount, abstractCount };
  }, [scoredWords]);

  const handleExportWords = useCallback(() => {
    const rows = ['Word,In Core Deck,Category,Score,Recommendation,Confidence,Explanation,Appearances,Avg Top %,Strong,Weak,Override'];
    filtered.forEach(w => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      rows.push([
        esc(w.word), w.in_core_deck ? 'Yes' : 'No', esc(w.category),
        w.strengthScore, w.recommendation.toUpperCase(), w.confidence,
        esc(w.explanation), w.times_used, Math.round(w.avg_top_answer_pct),
        w.strong_appearances, w.weak_appearances, w.deck_override || '',
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jinx_word_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} words`);
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Deck Balance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard label="Core deck size" value={deckSummary.coreSize} />
        <SummaryCard label="Cut candidates" value={deckSummary.cutCandidates.length} cls="text-destructive" />
        <SummaryCard label="Add candidates" value={deckSummary.addCandidates.length} cls="text-primary" />
        <SummaryCard label="Concrete / Abstract" value={`${deckSummary.concreteCount} / ${deckSummary.abstractCount}`} />
      </div>

      {/* Category Health */}
      {deckSummary.catHealth.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Category health (core deck)</p>
          <div className="flex flex-wrap gap-1.5">
            {deckSummary.catHealth.map(c => (
              <span key={c.cat} className={`text-[10px] font-display font-bold px-2 py-1 rounded-lg border border-border/50 ${c.avgScore >= 60 ? 'bg-[hsl(var(--keep))]/10 text-[hsl(var(--keep))]' : c.avgScore < 40 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                {c.cat} <span className="font-normal opacity-70">({c.count}, avg {c.avgScore})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cut candidates */}
      {deckSummary.cutCandidates.length > 0 && (
        <CandidateChips title="🔻 Cut candidates" words={deckSummary.cutCandidates}
          chipCls="bg-destructive/10 text-destructive" onClick={setSelectedWord} />
      )}

      {/* Add candidates */}
      {deckSummary.addCandidates.length > 0 && (
        <CandidateChips title="🔺 Add candidates" words={deckSummary.addCandidates}
          chipCls="bg-primary/10 text-primary" onClick={setSelectedWord} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search words…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-8 text-xs" />
        </div>
        <select value={filterRec} onChange={e => { setFilterRec(e.target.value as any); setPage(0); }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="all">All recs</option>
          <option value="keep">Keep</option>
          <option value="watch">Watch</option>
          <option value="cut">Cut</option>
          <option value="add">Add</option>
        </select>
        <select value={filterDeck} onChange={e => { setFilterDeck(e.target.value as any); setPage(0); }}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="all">All words</option>
          <option value="core">Core deck</option>
          <option value="non-core">Non-core</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExportWords} className="h-8 text-xs gap-1">
          <Download className="h-3 w-3" /> Export
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border/50 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <Th label="Word" sortKey="word" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-wider font-semibold text-muted-foreground w-12">Deck</th>
              <Th label="Score" sortKey="strengthScore" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right w-14" />
              <Th label="Apps" sortKey="times_used" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right w-12" />
              <Th label="Top%" sortKey="avg_top_answer_pct" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right w-14" />
              <Th label="S/W" sortKey="strong_appearances" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right w-12" />
              <Th label="Rec" sortKey="recommendation" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-center w-16" />
              <th className="px-2 py-2 text-left text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Override</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(w => (
              <tr key={w.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors cursor-pointer"
                onClick={() => setSelectedWord(w)}>
                <td className="px-3 py-2">
                  <span className="font-display font-bold text-sm">{w.word}</span>
                  <span className="text-[9px] text-muted-foreground ml-1.5">{w.category}</span>
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={e => { e.stopPropagation(); toggleCoreDeck(w); }}
                    className={`w-4 h-4 rounded border transition-colors ${w.in_core_deck ? 'bg-primary border-primary' : 'border-border'}`}>
                    {w.in_core_deck && <span className="text-primary-foreground text-[8px]">✓</span>}
                  </button>
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold">{w.strengthScore}</td>
                <td className="px-2 py-2 text-right tabular-nums">{w.times_used}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Math.round(w.avg_top_answer_pct)}%</td>
                <td className="px-2 py-2 text-right">
                  <span className="text-[hsl(var(--keep))]">{w.strong_appearances}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-destructive">{w.weak_appearances}</span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${recBadge[w.recommendation]}`}>
                    {w.recommendation}
                  </span>
                </td>
                <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                  <select value={w.deck_override || ''} onChange={e => setOverride(w, e.target.value)}
                    className="h-6 rounded border border-input bg-background px-1 text-[10px] w-full max-w-[90px]">
                    {OVERRIDES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} words</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="px-2 py-1">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Override differences */}
      {scoredWords.some(w => w.deck_override && w.deck_override !== '') && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Manual overrides active</p>
          <div className="flex flex-wrap gap-1.5">
            {scoredWords.filter(w => w.deck_override).map(w => {
              const differs = (w.deck_override === 'locked_keep' && w.recommendation !== 'keep') ||
                (w.deck_override === 'locked_cut' && w.recommendation !== 'cut');
              return (
                <span key={w.id} className={`text-[10px] font-display font-bold px-2 py-1 rounded-lg border ${differs ? 'border-[hsl(var(--review))] bg-[hsl(var(--review))]/10' : 'border-border/50 bg-muted/30'}`}>
                  {w.word}
                  <span className="font-normal opacity-70 ml-1">
                    {OVERRIDES.find(o => o.value === w.deck_override)?.label}
                    {differs && ' ≠ auto'}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <WordDetailDialog word={selectedWord} open={!!selectedWord} onOpenChange={open => { if (!open) setSelectedWord(null); }} />
    </div>
  );
}

function SummaryCard({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-2.5 text-center">
      <p className={`text-lg font-display font-bold ${cls || ''}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function Th({ label, sortKey, current, dir, onSort, className }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  return (
    <th className={`px-2 py-2 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground ${className || 'text-left'}`}
      onClick={() => onSort(sortKey)}>
      {label} {current === sortKey && (dir === 'asc' ? '↑' : '↓')}
    </th>
  );
}

function CandidateChips({ title, words, chipCls, onClick }: {
  title: string; words: ScoredWord[]; chipCls: string; onClick: (w: ScoredWord) => void;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {words.slice(0, 15).map(w => (
          <button key={w.id} onClick={() => onClick(w)}
            className={`text-[10px] font-display font-bold px-2 py-1 rounded-lg hover:opacity-80 transition-opacity ${chipCls}`}>
            {w.word} <span className="font-normal opacity-60">{w.strengthScore}</span>
          </button>
        ))}
        {words.length > 15 && <span className="text-[10px] text-muted-foreground px-2 py-1">+{words.length - 15} more</span>}
      </div>
    </div>
  );
}
