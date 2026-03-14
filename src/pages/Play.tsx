import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getActivePrompts, hasSubmitted, submitAnswer, getUserAnswer, type DbPrompt, type DbAnswer } from '@/lib/store';
import ResultsView from '@/components/ResultsView';

type Phase = 'input' | 'calculating' | 'results';

export default function Play() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Record<string, Phase>>({});

  useEffect(() => {
    (async () => {
      const ps = await getDailyPrompts();
      setPrompts(ps);
      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      const phaseMap: Record<string, Phase> = {};
      await Promise.all(ps.map(async (p) => {
        subMap[p.id] = await hasSubmitted(p.id);
        const ua = await getUserAnswer(p.id);
        if (ua) ansMap[p.id] = ua;
        phaseMap[p.id] = subMap[p.id] ? 'results' : 'input';
      }));
      setSubmitted(subMap);
      setUserAnswers(ansMap);
      setPhase(phaseMap);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Loading today's prompts…</p>
      </div>
    </div>
  );

  if (prompts.length === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No prompts for today yet.</p>
        <p className="text-xs text-muted-foreground">Check back soon — new prompts drop daily.</p>
        <Button asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );

  const prompt = prompts[currentIdx];
  const currentPhase = phase[prompt.id] || 'input';
  const isSubmitted = submitted[prompt.id];
  const allDone = prompts.every(p => submitted[p.id]);

  const handleSubmit = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed || isSubmitted || submitting) return;
    setSubmitting(true);
    try {
      const answer = await submitAnswer(prompt.id, trimmed);
      setSubmitted(prev => ({ ...prev, [prompt.id]: true }));
      setUserAnswers(prev => ({ ...prev, [prompt.id]: answer }));
      setInputVal('');
      // Show calculating phase
      setPhase(prev => ({ ...prev, [prompt.id]: 'calculating' }));
      setTimeout(() => {
        setPhase(prev => ({ ...prev, [prompt.id]: 'results' }));
      }, 1800);
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => setCurrentIdx(i => Math.min(prompts.length - 1, i + 1));
  const goPrev = () => setCurrentIdx(i => Math.max(0, i - 1));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border shrink-0">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">JINX</Link>
          <div className="flex items-center gap-3">
            {/* Prompt dots */}
            <div className="flex gap-1.5">
              {prompts.map((p, i) => (
                <button key={p.id} onClick={() => setCurrentIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentIdx
                      ? 'bg-primary scale-125'
                      : submitted[p.id]
                        ? 'bg-muted-foreground/60'
                        : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-display">{currentIdx + 1}/{prompts.length}</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center pt-6 pb-20">
        <div className="container max-w-md px-4">
          <AnimatePresence mode="wait">
            <motion.div key={prompt.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

              {/* Prompt card */}
              <div className="game-card text-center mb-6">
                {/* Instruction */}
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-6">
                  Type the ONE word you think most players will also submit
                </p>

                {/* Prompt words — stacked vertically */}
                <div className="flex flex-col items-center gap-2 mb-2">
                  <span className="font-display text-3xl md:text-4xl font-bold tracking-tight">{prompt.word_a}</span>
                  <span className="text-muted-foreground text-lg font-display">+</span>
                  <span className="font-display text-3xl md:text-4xl font-bold tracking-tight">{prompt.word_b}</span>
                </div>

                {/* Example */}
                <p className="text-[11px] text-muted-foreground/60 mb-6">
                  Example (not today's puzzle):<br />
                  <span className="font-display">COW + SNOW</span> → <span className="font-display font-semibold text-muted-foreground">Milk</span>
                </p>

                {/* Input or submitted state */}
                {!isSubmitted ? (
                  <div className="space-y-3 max-w-xs mx-auto">
                    <div className="flex gap-2">
                      <Input
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Your answer…"
                        className="rounded-2xl text-center font-display bg-secondary border-border h-12 text-base"
                        maxLength={50}
                        autoFocus
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={!inputVal.trim() || submitting}
                        size="icon"
                        className="rounded-2xl shrink-0 h-12 w-12"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50">Single word answers work best</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 text-muted-foreground py-2"
                  >
                    <Check className="h-4 w-4 text-keep" />
                    <span className="text-sm">Submitted: <span className="font-display font-bold text-foreground">{userAnswers[prompt.id]?.raw_answer}</span></span>
                  </motion.div>
                )}
              </div>

              {/* Calculating phase */}
              {currentPhase === 'calculating' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="game-card text-center py-10"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-display">Calculating results…</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">Comparing your answer with other players</p>
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
                  <Button onClick={goNext} className="w-full rounded-2xl mt-4 h-12">
                    Next prompt <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* All done */}
              {allDone && currentPhase === 'results' && currentIdx === prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-6 space-y-3">
                  <p className="text-sm text-muted-foreground">🎉 You've completed today's set!</p>
                  <Button variant="outline" className="rounded-2xl" asChild>
                    <Link to="/">Back to home</Link>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          <div className="flex justify-between mt-6">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIdx === 0} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIdx === prompts.length - 1} className="text-muted-foreground">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/40">Prototype of JINX — a party word game in development</p>
      </footer>
    </div>
  );
}
