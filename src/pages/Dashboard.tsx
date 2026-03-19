import { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload, Download, Search, ArrowLeft, FileSpreadsheet,
  RefreshCw, CheckCircle, Database, BarChart3, Trash2, Loader2,
  AlertCircle, Eye, TrendingDown, Clock, HelpCircle, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getWords, importWordsFromCSV, getImportSources, updateWord, bulkUpdateStatus,
  type DbWord, type DbImportSource
} from '@/lib/store';
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
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className="bg-card border border-border rounded-xl w-full text-left flex items-center gap-2 px-4 py-2.5 hover:border-muted-foreground/30 transition-colors"
    >
      <span className="font-display text-sm font-semibold flex-1 truncate">{word.word}</span>
      <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{word.category}</span>
      <span className={`text-[9px] font-display ${confLabel.cls}`}>{confLabel.label}</span>
      <span className="font-display text-[10px] text-muted-foreground/40 tabular-nums w-6 text-right">{word.jinx_score}</span>
      <Badge variant="outline" className={`${STATUS_COLORS[word.status as WordStatus]} text-[9px] px-1.5 py-0 border-0 rounded-md`}>{word.status}</Badge>
    </motion.button>
  );
}

export default function Dashboard() {
  const [words, setWords] = useState<DbWord[]>([]);
  const [sources, setSources] = useState<DbImportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WordStatus | 'all'>('all');
  const [catFilter, setCatFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedWord, setSelectedWord] = useState<DbWord | null>(null);
  const [tab, setTab] = useState('queue');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [w, s] = await Promise.all([getWords(), getImportSources()]);
    setWords(w);
    setSources(s);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Actionable sections
  const sections = useMemo(() => {
    const needsReview = words.filter(w => w.status === 'unreviewed' || w.status === 'review');
    const likelyKeeps = words.filter(w => {
      const conf = getConfidence(w);
      return w.status === 'keep' || (conf === 'high' && (w.strong_appearances ?? 0) > (w.weak_appearances ?? 0) && w.status !== 'cut');
    });
    const likelyCuts = words.filter(w => {
      return w.status === 'cut' || ((w.weak_appearances ?? 0) >= 3 && (w.strong_appearances ?? 0) < (w.weak_appearances ?? 0) && w.status !== 'keep');
    });
    const lowConfidence = words.filter(w => getConfidence(w) === 'low' && w.status !== 'cut');
    const recentlyUpdated = [...words]
      .filter(w => w.updated_at !== w.created_at)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);

    return { needsReview, likelyKeeps, likelyCuts, lowConfidence, recentlyUpdated };
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

  const handleBulkUnreviewedToReview = async () => {
    await bulkUpdateStatus('unreviewed', 'review');
    await loadData();
  };

  const handleExport = () => {
    const csv = ['word,category,status,jinx_score,notes', ...words.map(w => `${w.word},${w.category},${w.status},${w.jinx_score},"${w.notes}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'jinx_deck_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <div className="text-center space-y-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">Loading deck…</p>
      </div>
    </div>
  );

  if (selectedWord) {
    return (
      <div className="min-h-screen bg-background theme-dashboard">
        <nav className="border-b border-border">
          <div className="container flex items-center h-14 gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedWord(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <span className="text-sm text-muted-foreground">Dashboard</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="font-display text-sm font-semibold">{selectedWord.word}</span>
          </div>
        </nav>
        <div className="container max-w-2xl py-6">
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
    <div className="min-h-screen bg-background theme-dashboard">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-display text-lg font-bold tracking-tight jinx-gradient-text">JINX</Link>
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Creator</span>
          </div>
          <Button size="sm" variant="outline" asChild><Link to="/play">Play →</Link></Button>
        </div>
      </nav>

      <div className="container py-5 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Database, label: 'Total', value: words.length, color: 'text-muted-foreground' },
            { icon: CheckCircle, label: 'Keep', value: statusCounts.keep, color: 'text-[hsl(var(--keep))]' },
            { icon: Eye, label: 'Review', value: statusCounts.review + statusCounts.unreviewed, color: 'text-[hsl(var(--review))]' },
            { icon: Trash2, label: 'Cut', value: statusCounts.cut, color: 'text-[hsl(var(--cut))]' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <s.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-display font-bold">{s.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary rounded-xl h-9">
            <TabsTrigger value="queue" className="rounded-lg text-xs">Review Queue</TabsTrigger>
            <TabsTrigger value="browse" className="rounded-lg text-xs">Browse All</TabsTrigger>
            <TabsTrigger value="actions" className="rounded-lg text-xs">Actions</TabsTrigger>
          </TabsList>

          {/* Actionable Queue */}
          <TabsContent value="queue" className="mt-4 space-y-6">
            {/* Needs Review */}
            {sections.needsReview.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--review))]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Needs review <span className="text-foreground/50">({sections.needsReview.length})</span>
                  </span>
                </div>
                <div className="space-y-1">
                  {sections.needsReview.slice(0, 15).map(w => (
                    <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                  ))}
                  {sections.needsReview.length > 15 && (
                    <p className="text-[10px] text-muted-foreground text-center py-1">
                      +{sections.needsReview.length - 15} more — use Browse All to see everything
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Likely Cuts */}
            {sections.likelyCuts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--cut))]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

            {/* Low Confidence */}
            {sections.lowConfidence.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Low confidence — needs more data <span className="text-foreground/50">({sections.lowConfidence.length})</span>
                  </span>
                </div>
                <div className="space-y-1">
                  {sections.lowConfidence.slice(0, 10).map(w => (
                    <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                  ))}
                </div>
              </div>
            )}

            {/* Recently Updated */}
            {sections.recentlyUpdated.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recently updated
                  </span>
                </div>
                <div className="space-y-1">
                  {sections.recentlyUpdated.map(w => (
                    <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
                  ))}
                </div>
              </div>
            )}

            {sections.needsReview.length === 0 && sections.likelyCuts.length === 0 && sections.lowConfidence.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--keep))]" />
                <p className="text-sm font-semibold">Queue is clear</p>
                <p className="text-xs mt-1">All words have been reviewed. Nice work!</p>
              </div>
            )}
          </TabsContent>

          {/* Browse All */}
          <TabsContent value="browse" className="mt-4 space-y-3">
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

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words…" className="pl-9 rounded-xl bg-secondary border-border h-9 text-sm" />
            </div>

            {/* Word list */}
            <div className="space-y-1">
              {filteredWords.map(w => (
                <WordRow key={w.id} word={w} onClick={() => setSelectedWord(w)} />
              ))}
              {filteredWords.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-xs">{words.length === 0 ? 'No words imported yet. Use the Actions tab to import.' : 'No matching words.'}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-4 space-y-2">
            {/* Import sources */}
            {sources.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-xs font-medium text-muted-foreground">Import History</span>
                </div>
                {sources.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5">
                    <span>{s.name}</span>
                    <span className="tabular-nums">{s.rows_imported} rows · {new Date(s.last_sync).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImport} />
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Import starting deck (CSV)
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" onClick={handleBulkUnreviewedToReview}>
              <RefreshCw className="h-4 w-4 mr-2" /> Bulk set Unreviewed → Review
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" asChild>
              <Link to="/dashboard/answers"><Trash2 className="h-4 w-4 mr-2" /> Clean answer data (merge / delete)</Link>
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" asChild>
              <Link to="/dashboard/prompts"><CheckCircle className="h-4 w-4 mr-2" /> Prompt quality review</Link>
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export final deck snapshot
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" onClick={handleBackfill}>
              <BarChart3 className="h-4 w-4 mr-2" /> Backfill all metrics from play data
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
