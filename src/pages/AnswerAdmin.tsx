import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Merge, Trash2, Loader2, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getActivePrompts, getArchivePrompts, getStats, mergeAnswers, deleteAnswersByNormalized,
  getTotalSubmissions, type DbPrompt, type AnswerStat,
} from '@/lib/store';

export default function AnswerAdmin() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<DbPrompt | null>(null);
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // Merge state
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [mergeSourceCount, setMergeSourceCount] = useState(0);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [active, archive] = await Promise.all([getActivePrompts(), getArchivePrompts()]);
      const all = [...active, ...archive];
      // Deduplicate by id
      const seen = new Set<string>();
      const unique = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setPrompts(unique);
      setLoading(false);
    })();
  }, []);

  const loadStats = useCallback(async (promptId: string) => {
    setStatsLoading(true);
    const [s, t] = await Promise.all([getStats(promptId), getTotalSubmissions(promptId)]);
    setStats(s);
    setTotal(t);
    setStatsLoading(false);
  }, []);

  const selectPrompt = (p: DbPrompt) => {
    setSelectedPrompt(p);
    loadStats(p.id);
  };

  const startMerge = (answer: string, count: number) => {
    setMergeSource(answer);
    setMergeSourceCount(count);
    setMergeTarget('');
  };

  const confirmMerge = () => {
    if (!mergeTarget.trim()) return;
    setMergeConfirmOpen(true);
  };

  const executeMerge = async () => {
    if (!selectedPrompt || !mergeSource) return;
    setActionLoading(true);
    try {
      await mergeAnswers(selectedPrompt.id, mergeSource, mergeTarget.toLowerCase().trim());
      await loadStats(selectedPrompt.id);
    } catch (e) {
      console.error('Merge failed:', e);
    }
    setActionLoading(false);
    setMergeConfirmOpen(false);
    setMergeSource(null);
    setMergeTarget('');
  };

  const startDelete = (answer: string, count: number) => {
    setDeleteTarget(answer);
    setDeleteCount(count);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!selectedPrompt || !deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteAnswersByNormalized(selectedPrompt.id, deleteTarget);
      await loadStats(selectedPrompt.id);
    } catch (e) {
      console.error('Delete failed:', e);
    }
    setActionLoading(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center theme-dashboard">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background theme-dashboard">
      <nav className="border-b border-border">
        <div className="container flex items-center h-14 gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <span className="font-display text-sm font-bold tracking-tight">Answer Admin</span>
        </div>
      </nav>

      <div className="container max-w-2xl py-5 space-y-4">
        {!selectedPrompt ? (
          <>
            <p className="text-xs text-muted-foreground">Select a prompt to manage its answers.</p>
            <div className="space-y-1.5">
              {prompts.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPrompt(p)}
                  className="bg-card border border-border rounded-xl w-full text-left px-4 py-3 hover:border-muted-foreground/30 transition-colors"
                >
                  <span className="font-display text-sm font-bold">{p.word_a}</span>
                  <span className="text-muted-foreground mx-2">+</span>
                  <span className="font-display text-sm font-bold">{p.word_b}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-3">{p.date} · {p.mode}</span>
                </button>
              ))}
              {prompts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No prompts found.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPrompt(null); setMergeSource(null); }}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <div>
                <span className="font-display text-sm font-bold">{selectedPrompt.word_a} + {selectedPrompt.word_b}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{total} submissions</span>
              </div>
            </div>

            {statsLoading ? (
              <div className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1">
                {stats.map(s => (
                  <div key={s.normalized_answer} className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="font-display text-[10px] text-muted-foreground/40 w-5 text-right">#{s.rank}</span>
                    <span className="font-display text-sm font-semibold flex-1 break-words min-w-0">{s.normalized_answer}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {s.percentage}% ({s.count})
                    </span>

                    {mergeSource === s.normalized_answer ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={mergeTarget}
                          onChange={e => setMergeTarget(e.target.value)}
                          placeholder="Merge into…"
                          className="h-7 w-28 text-xs rounded-lg bg-secondary border-border"
                          autoFocus
                        />
                        <Button size="sm" className="h-7 px-2 text-[10px] rounded-lg" onClick={confirmMerge} disabled={!mergeTarget.trim()}>
                          Go
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setMergeSource(null)}>
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                          onClick={() => startMerge(s.normalized_answer, s.count)}
                          title="Merge into another answer"
                        >
                          <Merge className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
                          onClick={() => startDelete(s.normalized_answer, s.count)}
                          title="Delete this answer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {stats.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No answers yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Merge Confirmation */}
      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Merge className="h-4 w-4" /> Merge Answers
            </AlertDialogTitle>
            <AlertDialogDescription>
              Merge <strong>"{mergeSource}"</strong> into <strong>"{mergeTarget}"</strong>?
              <br />
              This will reassign <strong>{mergeSourceCount}</strong> {mergeSourceCount === 1 ? 'submission' : 'submissions'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeMerge} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Delete Answer
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{deleteTarget}"</strong>? This will remove <strong>{deleteCount}</strong> {deleteCount === 1 ? 'submission' : 'submissions'} permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
