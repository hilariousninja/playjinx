import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getActivePrompts, hasSubmitted, submitAnswer, getUserAnswer, getTotalSubmissions, type DbPrompt, type DbAnswer } from '@/lib/store';
import ResultsView from '@/components/ResultsView';

type Phase = 'input' | 'calculating' | 'results';

// Persist completed prompts in localStorage
function getCompletedPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem('jinx_completed_prompts');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markPromptCompleted(promptId: string) {
  const completed = getCompletedPrompts();
  completed.add(promptId);
  localStorage.setItem('jinx_completed_prompts', JSON.stringify([...completed]));
}

export default function Play() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const ps = await getActivePrompts();
      setPrompts(ps);

      const localCompleted = getCompletedPrompts();
      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      const phaseMap: Record<string, Phase> = {};
      const countMap: Record<string, number> = {};

      await Promise.all(ps.map(async (p) => {
        // Check both server and local storage
        const serverSubmitted = await hasSubmitted(p.id);
        const localSubmitted = localCompleted.has(p.id);
        const didSubmit = serverSubmitted || localSubmitted;

        subMap[p.id] = didSubmit;

        if (didSubmit) {
          const ua = await getUserAnswer(p.id);
          if (ua) {
            ansMap[p.id] = ua;
            // Sync local storage if server knows but local doesn't
            if (!localSubmitted) markPromptCompleted(p.id);
          }
        }

        phaseMap[p.id] = didSubmit ? 'results' : 'input';
        countMap[p.id] = await getTotalSubmissions(p.id);
      }));

      setSubmitted(subMap);
      setUserAnswers(ansMap);
      setPhase(phaseMap);
      setPlayerCounts(countMap);

      // Auto-navigate to first unanswered prompt
      const firstUnanswered = ps.findIndex(p => !subMap[p.id]);
      if (firstUnanswered >= 0) {
        setCurrentIdx(firstUnanswered);
      } else if (ps.length > 0) {
        // All done — show last prompt results
        setCurrentIdx(ps.length - 1);
      }

      setLoading(false);
    })();
  }, []);

  const handleSubmit = useCallback(async () => {
    const prompt = prompts[currentIdx];
    if (!prompt) return;
    const trimmed = inputVal.trim();
    if (!trimmed || submitted[prompt.id] || submitting) return;

    setSubmitting(true);
    try {
      const answer = await submitAnswer(prompt.id, trimmed);
      setSubmitted(prev => ({ ...prev, [prompt.id]: true }));
      setUserAnswers(prev => ({ ...prev, [prompt.id]: answer }));
      setPlayerCounts(prev => ({ ...prev, [prompt.id]: (prev[prompt.id] || 0) + 1 }));
      setInputVal('');
      markPromptCompleted(prompt.id);

      setPhase(prev => ({ ...prev, [prompt.id]: 'calculating' }));
      setTimeout(() => {
        setPhase(prev => ({ ...prev, [prompt.id]: 'results' }));
        setSubmitting(false);
      }, 1300);
    } catch {
      setSubmitting(false);
    }
  }, [prompts, currentIdx, inputVal, submitted, submitting]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading prompts…</p>
      </div>
    </div>
  );

  if (prompts.length === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-5 px-6">
        <Zap className="h-10 w-10 text-primary mx-auto" />
        <h2 className="text-xl font-bold">No active prompts</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Check back soon — new prompts are on the way.</p>
        <Button className="rounded-2xl" asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );

  const prompt = prompts[currentIdx];
  const currentPhase = phase[prompt.id] || 'input';
  const isSubmitted = submitted[prompt.id];
  const allDone = prompts.every(p => submitted[p.id]);
  const completedCount = prompts.filter(p => submitted[p.id]).length;

  const goNext = () => { setCurrentIdx(i => Math.min(prompts.length - 1, i + 1)); setInputVal(''); };
  const goPrev = () => { setCurrentIdx(i => Math.max(0, i - 1)); setInputVal(''); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border shrink-0 bg-card/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14 max-w-lg mx-auto">
          <Link to="/" className="font-display text-lg font-bold tracking-tight jinx-gradient-text">JINX</Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {prompts.map((p, i) => (
                <button key={p.id} onClick={() => { setCurrentIdx(i); setInputVal(''); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIdx
                      ? 'w-6 h-2 bg-primary'
                      : submitted[p.id]
                        ? 'w-2 h-2 bg-primary/40'
                        : 'w-2 h-2 bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-display tabular-nums">
              {completedCount}/{prompts.length}
            </span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center pt-8 pb-24">
        <div className="w-full max-w-md mx-auto px-5">
          <AnimatePresence mode="wait">
            <motion.div key={prompt.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

              {/* Progress label */}
              <p className="text-center text-[11px] text-muted-foreground/60 font-display tracking-widest uppercase mb-4">
                Prompt {currentIdx + 1} of {prompts.length}
              </p>

              {/* Prompt card */}
              <div className="game-card-elevated text-center mb-5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] mb-8 leading-relaxed">
                  Find the bridge-word
                </p>

                <div className="flex flex-col items-center gap-1 mb-3">
                  <span className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">{prompt.word_a}</span>
                  <span className="text-primary text-xl font-display font-bold my-1">+</span>
                  <span className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">{prompt.word_b}</span>
                </div>

                <p className="text-[10px] text-muted-foreground/40 mb-8">
                  e.g. <span className="font-display">COW + SNOW</span> → <span className="font-display font-semibold text-muted-foreground/60">Milk</span>
                </p>

                {/* Input — only if not submitted */}
                {currentPhase === 'input' && !isSubmitted ? (
                  <div className="space-y-3 max-w-xs mx-auto">
                    <div className="flex gap-2">
                      <Input
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Type one word…"
                        className="rounded-xl text-center font-display bg-secondary/80 border-border/60 h-12 text-base focus:border-primary/40 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                        maxLength={50}
                        disabled={submitting}
                        autoFocus
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={!inputVal.trim() || submitting}
                        size="icon"
                        className="rounded-xl shrink-0 h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40">Single word answers work best</p>
                  </div>
                ) : isSubmitted && currentPhase !== 'calculating' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full"
                  >
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-display font-bold">{userAnswers[prompt.id]?.raw_answer}</span>
                  </motion.div>
                ) : null}
              </div>

              {/* Player count */}
              {(playerCounts[prompt.id] ?? 0) > 0 && (
                <p className="text-[11px] text-muted-foreground/40 text-center mb-5 flex items-center justify-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {playerCounts[prompt.id]} {playerCounts[prompt.id] === 1 ? 'player has' : 'players have'} answered
                </p>
              )}

              {/* Calculating reveal phase */}
              {currentPhase === 'calculating' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="game-card text-center py-12 space-y-4"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm text-foreground font-display font-semibold">Finding answer clusters…</p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[11px] text-muted-foreground/50"
                  >
                    Comparing your answer with other players
                  </motion.p>
                </motion.div>
              )}

              {/* Results */}
              {currentPhase === 'results' && isSubmitted && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <ResultsView promptId={prompt.id} />
                </motion.div>
              )}

              {/* Next prompt button */}
              {currentPhase === 'results' && isSubmitted && currentIdx < prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <Button onClick={goNext} className="w-full rounded-xl mt-5 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    Next prompt <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* All done */}
              {allDone && currentPhase === 'results' && currentIdx === prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-8 space-y-4">
                  <div className="text-3xl">🎉</div>
                  <p className="text-sm text-muted-foreground font-medium">You've completed today's set!</p>
                  <Button variant="outline" className="rounded-xl border-border/60" asChild>
                    <Link to="/">Back to home</Link>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIdx === 0} className="text-muted-foreground/60 hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIdx === prompts.length - 1} className="text-muted-foreground/60 hover:text-foreground">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — a party word game in development</p>
      </footer>
    </div>
  );
}
