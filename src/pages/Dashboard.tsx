import { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload, Download, Search, ArrowLeft, FileSpreadsheet,
  RefreshCw, Tag, CheckCircle, Database, BarChart3, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getWords, importWordsFromCSV, getImportSources, updateWord, bulkUpdateStatus, getJinxScoreBreakdown,
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">Loading deck…</p>
      </div>
    </div>
  );

  if (selectedWord) {
    return (
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-display text-lg font-bold tracking-tight">JINX</Link>
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
            { icon: CheckCircle, label: 'Keep', value: statusCounts.keep, color: 'text-keep' },
            { icon: BarChart3, label: 'Review', value: statusCounts.review, color: 'text-review' },
            { icon: Trash2, label: 'Cut', value: statusCounts.cut, color: 'text-cut' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <s.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${s.color}`} />
              <p className="text-lg font-display font-bold">{s.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Import sources */}
        {sources.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary rounded-xl h-9">
            <TabsTrigger value="queue" className="rounded-lg text-xs">Trimming Queue</TabsTrigger>
            <TabsTrigger value="actions" className="rounded-lg text-xs">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-3">
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
              {filteredWords.map((w, i) => (
                <motion.button key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  onClick={() => setSelectedWord(w)}
                  className="bg-card border border-border rounded-xl w-full text-left flex items-center gap-2 px-4 py-2.5 hover:border-muted-foreground/30 transition-colors"
                >
                  <span className="font-display text-sm font-semibold flex-1 truncate">{w.word}</span>
                  <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{w.category}</span>
                  <span className="font-display text-[10px] text-muted-foreground/40 tabular-nums w-6 text-right">{w.jinx_score}</span>
                  <Badge variant="outline" className={`${STATUS_COLORS[w.status as WordStatus]} text-[9px] px-1.5 py-0 border-0 rounded-md`}>{w.status}</Badge>
                </motion.button>
              ))}
              {filteredWords.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-xs">{words.length === 0 ? 'No words imported yet. Use the Actions tab to import.' : 'No matching words.'}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-4 space-y-2">
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
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" disabled>
              <Tag className="h-4 w-4 mr-2" /> Tag synonym clusters (coming soon)
            </Button>
            <Button variant="outline" className="w-full rounded-xl justify-start h-10 text-sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export final deck snapshot
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
