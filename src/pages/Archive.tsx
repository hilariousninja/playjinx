import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Send, Check, Loader2, ChevronRight, Zap } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getArchivePrompts, hasSubmitted, getTotalSubmissions, submitAnswer, getUserAnswer, type DbPrompt, type DbAnswer } from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import ResultsView from '@/components/ResultsView';
import JinxLogo from '@/components/JinxLogo';

export default function Archive() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const ps = await getArchivePrompts();
      setPrompts(ps);
      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      const totals: Record<string, number> = {};
      await Promise.all(ps.map(async (p) => {
        subMap[p.id] = await hasSubmitted(p.id);
        const ua = await getUserAnswer(p.id);
        if (ua) ansMap[p.id] = ua;
        totals[p.id] = await getTotalSubmissions(p.id);
      }));
      setSubmittedMap(subMap);
      setUserAnswers(ansMap);
      setTotalCounts(totals);
      setLoading(false);
    })();
  }, []);

  const grouped = prompts.reduce<Record<string, DbPrompt[]>>((acc, p) => {
    const d = p.date; (acc[d] = acc[d] || []).push(p); return acc;
  }, {});

  const selectedPrompt = prompts.find(p => p.id === selected);
  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    const trimmed = inputVal.trim();
    const validationError = validateInput(trimmed);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    if (submittedMap[selected]) return;

    setSubmitting(true);
    setInputError(null);
    try {
      const answer = await submitAnswer(selected, trimmed);
      setSubmittedMap(prev => ({ ...prev, [selected]: true }));
      setUserAnswers(prev => ({ ...prev, [selected]: answer }));
      setTotalCounts(prev => ({ ...prev, [selected]: (prev[selected] || 0) + 1 }));
      setInputVal('');
    } catch (err: any) {
      setInputError(err?.message || 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading archive…</p>
      </div>
    </div>
  );

  // ─── DETAIL SCREEN ───
  if (selectedPrompt) {
    const isSubmitted = submittedMap[selectedPrompt.id];
    const dateLabel = new Date(selectedPrompt.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border/80 shrink-0">
          <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
            <button onClick={() => { setSelected(null); setInputVal(''); setInputError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to="/">
              <JinxLogo size={18} className="text-foreground text-base" />
            </Link>
            <span className="w-4" />
          </div>
        </header>

        {/* Main */}
        <div className={`flex-1 flex flex-col items-center ${isSubmitted ? 'pt-[5vh] md:pt-[6vh]' : 'pt-[10vh] md:pt-[12vh]'} transition-all duration-300`}>
          <div className="w-full max-w-[22rem] mx-auto px-5">
            <div className="text-center">
              {/* Archive context — subtle date */}
              <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-display mb-4">{dateLabel}</p>

              {/* Prompt hero */}
              <div className="mb-4">
                <PromptPair wordA={selectedPrompt.word_a} wordB={selectedPrompt.word_b} size="lg" />
              </div>

              {!isSubmitted ? (
                <>
                  <p className="text-[13px] font-bold text-primary/80 mb-6">
                    What would most people say?
                  </p>

                  <div className="relative">
                    <Input
                      value={inputVal}
                      onChange={e => { setInputVal(e.target.value); setInputError(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      placeholder="Type your word…"
                      className={`rounded-xl text-center font-display bg-card h-14 text-lg border-2 focus:border-primary focus:ring-0 placeholder:text-muted-foreground/25 pr-14 shadow-sm ${inputError ? 'border-destructive' : 'border-border/60'}`}
                      maxLength={80}
                      disabled={submitting}
                      autoFocus
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputVal.trim() || submitting}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg h-10 w-10 bg-primary hover:bg-primary/90 shadow-sm active:scale-[0.93] transition-transform"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>

                  {inputError && (
                    <p className="text-[11px] text-destructive mt-2">{inputError}</p>
                  )}

                  {(totalCounts[selectedPrompt.id] ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground/40 flex items-center justify-center gap-1.5 mt-5">
                      <Users className="h-3 w-3" />
                      {totalCounts[selectedPrompt.id]} players answered this
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {/* Results */}
            {isSubmitted && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-2">
                <ResultsView promptId={selectedPrompt.id} />

                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setSelected(null); setInputVal(''); setInputError(null); }}
                    className="text-[10px] uppercase tracking-wide text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                  >
                    ← Back to archive
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <footer className="border-t border-border py-3 shrink-0">
          <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
        </footer>
      </div>
    );
  }

  // ─── LIST SCREEN ───
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — matches Play */}
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8" asChild>
              <Link to="/results">Results</Link>
            </Button>
            <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 text-xs h-8" asChild>
              <Link to="/play">Play today</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-[22rem] mx-auto px-5 pt-10">
          {/* Title — minimal */}
          <div className="mb-10">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Archive</h1>
            <p className="text-[11px] text-muted-foreground/50 mt-1">Past prompts and results.</p>
          </div>

          {/* Grouped list */}
          {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => {
            const isToday = date === todayStr;
            return (
              <div key={date} className="mb-10">
                {/* Date label */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] uppercase tracking-widest font-display text-muted-foreground/40">
                    {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && (
                    <span className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold flex items-center gap-1">
                      <Zap className="h-2 w-2" /> Live
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {ps.map((p, i) => {
                    const answered = submittedMap[p.id];
                    return (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.3 }}
                        onClick={() => setSelected(p.id)}
                        className="w-full text-left flex items-center justify-between bg-card border border-border/60 rounded-xl px-5 py-4 transition-all hover:border-primary/20 hover:shadow-sm group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-bold text-foreground text-[15px] tracking-tight">
                            {p.word_a} <span className="text-primary/50">+</span> {p.word_b}
                          </p>
                          {answered && userAnswers[p.id] && (
                            <p className="text-[10px] text-muted-foreground/40 mt-1 font-display">
                              → {userAnswers[p.id].raw_answer}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {answered && <Check className="h-3 w-3 text-primary/60" />}
                          <span className="text-[10px] text-muted-foreground/30 font-display tabular-nums flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {totalCounts[p.id] ?? 0}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 transition-colors" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer — matches Play */}
      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
