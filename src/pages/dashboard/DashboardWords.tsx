import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Upload, Download, RefreshCw, Loader2,
  AlertCircle, TrendingDown, HelpCircle, Clock, CheckCircle, ArrowLeft,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  getWords, importWordsFromCSV, getImportSources, updateWord, bulkUpdateStatus,
  type DbWord, type DbImportSource
} from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { WordStatus } from '@/lib/types';
import WordDetail from '@/components/WordDetail';

const STATUS_COLORS: Record<WordStatus, string> = {
  keep: 'status-keep',
  review: 'status-review',
  cut: 'status-cut',
  unreviewed: 'status-unreviewed',
};

const CATEGORIES = ['All', 'Abstract', 'Animals', 'Body Parts', 'Culture', 'Emotions', 'Events', 'Food', 'Materials', 'Nature', 'Objects', 'People', 'Places', 'Signals', 'Threat', 'Transport', 'Weather'];

type ConfidenceLevel = 'low' | 'medium' | 'high';

function getConfidence(word: DbWord): ConfidenceLevel {
  const totalAppearances = (word.strong_appearances ?? 0) + (word.weak_appearances ?? 0);
  if (totalAppearances < 2) return 'low';
  const strongRate = totalAppearances > 0 ? (word.strong_appearances ?? 0) / totalAppearances : 0;
  if (totalAppearances >= 5 && (strongRate >= 0.7 || strongRate <= 0.3)) return 'high';
  return 'medium';
}

function getConfidenceLabel(c: ConfidenceLevel) {
  if (c === 'high') return { label: 'High', cls: 'text-[hsl(var(--keep))]' };
  if (c === 'medium') return { label: 'Med', cls: 'text-[hsl(var(--review))]' };
  return { label: 'Low', cls: 'text-muted-foreground' };
}

function WordRow({ word, onClick }: { word: DbWord; onClick: () => void }) {
  const confidence = getConfidence(word);
  const confLabel = getConfidenceLabel(confidence);
  const strongApp = word.strong_appearances ?? 0;
  const weakApp = word.weak_appearances ?? 0;
  const totalApp = strongApp + weakApp;
  const strongRate = totalApp > 0 ? Math.round((strongApp / totalApp) * 100) : -1;
  
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className="bg-card border border-border/50 rounded-xl w-full text-left flex items-center gap-2 px-4 py-2.5 hover:border-primary/20 transition-colors"
    >
      <span className="font-display text-sm font-semibold flex-1 break-words min-w-0">{word.word}</span>
      <span className="text-[10px] text-muted-foreground/40 hidden sm:inline w-16 truncate">{word.category}</span>
      {strongRate >= 0 && (
        <span className={`text-[10px] font-display font-bold w-8 text-right ${
          strongRate >= 60 ? 'text-[hsl(var(--keep))]' : strongRate >= 40 ? 'text-[hsl(var(--review))]' : 'text-destructive'
        }`}>
          {strongRate}%
        </span>
      )}
      <span className={`text-[9px] font-display ${confLabel.cls} w-7`}>{confLabel.label}</span>
      <Badge variant="outline" className={`${STATUS_COLORS[word.status as WordStatus]} text-[9px] px-1.5 py-0 border-0 rounded-md`}>
        {word.status}
      </Badge>
    </motion.button>
  );
}

export default function DashboardWords() {
  const [searchParams] = useSearchParams();
  const [words, setWords] = useState<DbWord[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFilter = (searchParams.get('filter') as WordStatus | 'all') || 'all';
  const [filter, setFilter] = useState<WordStatus | 'all'>(initialFilter === 'review' ? 'review' : initialFilter);
  const [catFilter, setCatFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedWord, setSelectedWord] = useState<DbWord | null>(null);
  const [view, setView] = useState<'queue' | 'browse'>('queue');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const w = await getWords();
    setWords(w);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // If arriving with filter=review, show browse view
  useEffect(() => {
    if (initialFilter === 'review' || initialFilter === 'cut') {
      setView('browse');
      setFilter(initialFilter === 'cut' ? 'cut' : 'review');
    }
  }, [initialFilter]);

  const sections = useMemo(() => {
    const needsReview = words.filter(w => w.status === 'unreviewed' || w.status === 'review');
    const likelyCuts = words.filter(w =>
      w.status === 'cut' || ((w.weak_appearances ?? 0) >= 3 && (w.strong_appearances ?? 0) < (w.weak_appearances ?? 0) && w.status !== 'keep')
    );
    const lowConfidence = words.filter(w => getConfidence(w) === 'low' && w.status !== 'cut');
    return { needsReview, likelyCuts, lowConfidence };
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (filter !== 'all' && w.status !== filter) return false;
      if (catFilter !== 'All' && w.category !== catFilter) return false;
      if (search && !w.word.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [words, filter, catFilter, search]);

  const statusCounts = useMemo(() => {
    const c = { all: words.length, unreviewed: 0, keep: 0, review: 0, cut: 0 };
    words.forEach(w => { c[w.status as keyof typeof c]++; });
    return c;
  }, [words]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const count = await importWordsFromCSV(text, file.name);
    await loadData();
    alert(`Imported ${count} new words`);
    e.target.value = '';
  };

  const handleStatusChange = async (id: string, status: WordStatus) => {
    const updated = await updateWord(id, { status });
    if (updated) {
      setWords(prev => prev.map(w => w.id === id ? updated : w));
      if (selectedWord?.id === id) setSelectedWord(updated);
    }
  };

  const handleExport = () => {
    const csv = ['word,category,status,jinx_score,notes', ...words.map(w => `${w.word},${w.category},${w.status},${w.jinx_score},"${w.notes}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'jinx_deck_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackfill = async () => {
    const confirmed = confirm('Recompute metrics for ALL prompts and words from existing play data?');
    if (!confirmed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'backfill_all' },
      });
      if (error) throw error;
      alert(`Backfill complete: ${data?.prompts_processed ?? 0} prompts, ${data?.words_updated ?? 0} words.`);
      await loadData();
    } catch (e) {
      alert('Backfill failed.');
      console.error(e);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (selectedWord) {
    return (
      <div>
        <button
          onClick={() => setSelectedWord(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to words
        </button>
        <div className="max-w-xl">
          <WordDetail
            word={selectedWord}
            onStatusChange={(status) => handleStatusChange(selectedWord.id, status)}
            onNotesChange={async (notes) => {
              const updated = await updateWord(selectedWord.id, { notes });
              if (updated) { setSelectedWord(updated); setWords(prev => prev.map(w => w.id === updated.id ? updated : w)); }
            }}
            onScoreChange={async (score) => {
              const updated = await updateWord(selectedWord.id, { jinx_score: score });
              if (updated) { setSelectedWord(updated); setWords(prev => prev.map(w => w.id === updated.id ? updated : w)); }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Words</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImport} />
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={handleBackfill}>
            <BarChart3 className="h-3 w-3 mr-1" /> Backfill
          </Button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setView('queue')}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
            view === 'queue' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Review Queue
        </button>
        <button
          onClick={() => setView('browse')}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
            view === 'browse' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Browse All ({words.length})
        </button>
      </div>

      {view === 'queue' ? (
        <div className="space-y-6">
          {sections.needsReview.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--review))]" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Needs review <span className="text-foreground/50">({sections.needsReview.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {sections.needsReview.slice(0, 15).map(w => (
                  <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                ))}
                {sections.needsReview.length > 15 && (
                  <button onClick={() => { setView('browse'); setFilter('review'); }} className="text-[10px] text-primary hover:underline py-1 w-full text-center">
                    View all {sections.needsReview.length} →
                  </button>
                )}
              </div>
            </div>
          )}

          {sections.likelyCuts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Likely cuts <span className="text-foreground/50">({sections.likelyCuts.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {sections.likelyCuts.slice(0, 10).map(w => (
                  <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                ))}
              </div>
            </div>
          )}

          {sections.lowConfidence.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Low confidence <span className="text-foreground/50">({sections.lowConfidence.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {sections.lowConfidence.slice(0, 10).map(w => (
                  <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                ))}
              </div>
            </div>
          )}

          {sections.needsReview.length === 0 && sections.likelyCuts.length === 0 && sections.lowConfidence.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--keep))]" />
              <p className="text-sm font-semibold">Queue is clear</p>
              <p className="text-xs mt-1">All words reviewed.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Status filters */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'unreviewed', 'keep', 'review', 'cut'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-full transition-colors font-medium ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1 opacity-50">{statusCounts[f]}</span>
              </button>
            ))}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  catFilter === c
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                }`}
              >{c}</button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words…" className="pl-9 rounded-xl bg-secondary border-border h-9 text-sm" />
          </div>

          <div className="space-y-1">
            {filteredWords.map(w => (
              <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
            ))}
            {filteredWords.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-10">No matching words.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
