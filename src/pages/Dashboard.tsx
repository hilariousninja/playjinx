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
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (selectedWord) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border">
          <div className="container flex items-center h-14 gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedWord(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <span className="font-display text-lg font-bold">Dashboard</span>
          </div>
        </nav>
        <div className="container max-w-2xl py-8">
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
            <span className="text-xs text-muted-foreground">/ Dashboard</span>
          </div>
          <Button size="sm" asChild><Link to="/play">Play</Link></Button>
        </div>
      </nav>

      <div className="container py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="game-card">
            <Database className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-2xl font-display font-bold">{words.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Words</p>
          </div>
          <div className="game-card">
            <CheckCircle className="h-4 w-4 text-keep mb-1" />
            <p className="text-2xl font-display font-bold">{statusCounts.keep}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Keep</p>
          </div>
          <div className="game-card">
            <BarChart3 className="h-4 w-4 text-review mb-1" />
            <p className="text-2xl font-display font-bold">{statusCounts.review}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Review</p>
          </div>
          <div className="game-card">
            <Trash2 className="h-4 w-4 text-cut mb-1" />
            <p className="text-2xl font-display font-bold">{statusCounts.cut}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Cut</p>
          </div>
        </div>

        {sources.length > 0 && (
          <div className="game-card">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Import Sources</span>
            </div>
            {sources.map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                <span>{s.name}</span>
                <span>{s.rows_imported} rows · {new Date(s.last_sync).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary rounded-2xl">
            <TabsTrigger value="queue" className="rounded-xl">Trimming Queue</TabsTrigger>
            <TabsTrigger value="actions" className="rounded-xl">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'unreviewed', 'keep', 'review', 'cut'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`stat-pill transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1 opacity-60">{statusCounts[f]}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${catFilter === c ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >{c}</button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words..." className="pl-9 rounded-2xl bg-secondary border-border" />
            </div>

            <div className="space-y-1">
              {filteredWords.map((w, i) => (
                <motion.button key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  onClick={() => setSelectedWord(w)}
                  className="game-card w-full text-left flex items-center gap-3 py-3 hover:border-muted-foreground/30 transition-colors"
                >
                  <span className="font-display font-semibold flex-1">{w.word}</span>
                  <span className="text-xs text-muted-foreground">{w.category}</span>
                  <span className="font-display text-xs">{w.jinx_score}</span>
                  <Badge variant="outline" className={`${STATUS_COLORS[w.status as WordStatus]} text-[10px] px-1.5 py-0 border-0`}>{w.status}</Badge>
                </motion.button>
              ))}
              {filteredWords.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">{words.length === 0 ? 'No words imported yet. Use the Actions tab to import.' : 'No matching words.'}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-4 space-y-3">
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImport} />
            <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Import starting deck (CSV)
            </Button>
            <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={handleBulkUnreviewedToReview}>
              <RefreshCw className="h-4 w-4 mr-2" /> Bulk set Unreviewed → Review
            </Button>
            <Button variant="outline" className="w-full rounded-2xl justify-start" disabled>
              <Tag className="h-4 w-4 mr-2" /> Tag synonym clusters (coming soon)
            </Button>
            <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export final deck snapshot
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
