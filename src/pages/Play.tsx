import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2, Zap, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ensureDailyPrompts, hasSubmitted, submitAnswer, getUserAnswer, getTotalSubmissions, getCompletedPrompts, markPromptCompleted, type DbPrompt, type DbAnswer } from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import ResultsView from '@/components/ResultsView';
import Countdown from '@/components/Countdown';
import JinxLogo from '@/components/JinxLogo';
import Onboarding, { hasSeenOnboarding } from '@/components/Onboarding';

type Phase = 'input' | 'calculating' | 'results';

export default function Play() {
  const [searchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasSeenOnboarding()) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    (async () => {
      const ps = await ensureDailyPrompts();
      setPrompts(ps);

      const localCompleted = getCompletedPrompts();
      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      const phaseMap: Record<string, Phase> = {};
      const countMap: Record<string, number> = {};

      await Promise.all(ps.map(async (p) => {
        const serverSubmitted = await hasSubmitted(p.id);
        const localSubmitted = localCompleted.has(p.id);
        const didSubmit = serverSubmitted || localSubmitted;
        subMap[p.id] = didSubmit;
        if (didSubmit) {
          const ua = await getUserAnswer(p.id);
          if (ua) {
            ansMap[p.id] = ua;
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

      const promptParam = searchParams.get('prompt');
      if (promptParam !== null) {
        const idx = parseInt(promptParam, 10);
        if (!isNaN(idx) && idx >= 0 && idx < ps.length) setCurrentIdx(idx);
      } else {
        const firstUnanswered = ps.findIndex(p => !subMap[p.id]);
        if (firstUnanswered >= 0) setCurrentIdx(firstUnanswered);
        else if (ps.length > 0) setCurrentIdx(ps.length - 1);
      }

      setLoading(false);
    })();
  }, []);

  const handleSubmit = useCallback(async () => {
    const prompt = prompts[currentIdx];
    if (!prompt) return;
    const trimmed = inputVal.trim();
    
    // Client-side validation
    const validationError = validateInput(trimmed);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    
    if (submitted[prompt.id] || submitting) return;

    setSubmitting(true);
    setInputError(null);
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
    } catch (err: any) {
      setInputError(err?.message || 'Something went wrong');
      setSubmitting(false);
    }
  }, [prompts, currentIdx, inputVal, submitted, submitting]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading prompts…</p>
      </div>
    </div>
  );

  if (prompts.length === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <Zap className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-lg font-bold text-foreground">No active prompts</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Check back soon — new prompts are on the way.</p>
        <Button className="rounded-lg" asChild><Link to="/">Home</Link></Button>
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
      {/* Onboarding overlay */}
      <AnimatePresence>
        {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-border shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={20} className="text-foreground text-lg" />
          </Link>
          <div className="flex items-center gap-3">
            {/* Dot progress */}
            <div className="flex items-center gap-2">
              {prompts.map((p, i) => (
                <button key={p.id} onClick={() => { setCurrentIdx(i); setInputVal(''); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIdx
                      ? 'w-6 h-2 bg-primary'
                      : submitted[p.id]
                        ? 'w-2 h-2 bg-primary/30'
                        : 'w-2 h-2 bg-border'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-display tabular-nums">
              {completedCount}/{prompts.length}
            </span>
            {/* Persistent Results button */}
            {completedCount > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2" asChild>
                <Link to="/results">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-start justify-center pt-8 pb-24">
        <div className="w-full max-w-md mx-auto px-5">
          <AnimatePresence mode="wait">
            <motion.div key={prompt.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>

              <p className="text-center text-[11px] text-muted-foreground font-display tracking-widest uppercase mb-6">
                Prompt {currentIdx + 1} of {prompts.length}
              </p>

              {/* Prompt hero */}
              <div className="text-center mb-6">
                <div className="flex flex-col items-center gap-0 mb-8">
                  <span className="font-display text-5xl md:text-6xl font-bold tracking-tight text-foreground">{prompt.word_a}</span>
                  <span className="text-primary text-2xl font-display font-bold my-2">+</span>
                  <span className="font-display text-5xl md:text-6xl font-bold tracking-tight text-foreground">{prompt.word_b}</span>
                </div>
              </div>

              {/* Objective + Input */}
              {currentPhase === 'input' && !isSubmitted ? (
                <div className="game-card-elevated text-center py-8 px-6 mb-5">
                  <p className="text-base font-bold text-primary mb-1">
                    Think: what will MOST people say?
                  </p>
                  <p className="text-xs text-muted-foreground/80 mb-6">
                    You're not trying to be correct — you're trying to match the crowd.
                  </p>
                  <div className="flex gap-2 max-w-xs mx-auto">
                    <Input
                      value={inputVal}
                      onChange={e => { setInputVal(e.target.value); setInputError(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      placeholder="Enter your answer..."
                      className={`rounded-lg text-center font-display bg-background h-12 text-base focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/40 ${inputError ? 'border-destructive' : 'border-border'}`}
                      maxLength={80}
                      disabled={submitting}
                      autoFocus
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputVal.trim() || submitting}
                      size="icon"
                      className="rounded-lg shrink-0 h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {inputError ? (
                    <p className="text-[11px] text-destructive mt-2">{inputError}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 mt-3">Single word answers work best</p>
                  )}
                </div>
              ) : isSubmitted && currentPhase !== 'calculating' ? (
                <div className="text-center mb-5">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full"
                  >
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-display font-bold">Your answer: {userAnswers[prompt.id]?.raw_answer}</span>
                  </motion.div>
                </div>
              ) : null}

              {/* Player count */}
              {(playerCounts[prompt.id] ?? 0) > 0 && currentPhase !== 'calculating' && (
                <p className="text-[11px] text-muted-foreground/60 text-center mb-5 flex items-center justify-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {playerCounts[prompt.id]} {playerCounts[prompt.id] === 1 ? 'player has' : 'players have'} answered
                </p>
              )}

              {/* Calculating */}
              {currentPhase === 'calculating' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="game-card text-center py-12 space-y-3"
                >
                  <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm text-foreground font-display font-semibold">Finding answer clusters…</p>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-[11px] text-muted-foreground">
                    Comparing your answer with other players
                  </motion.p>
                </motion.div>
              )}

              {/* Results */}
              {currentPhase === 'results' && isSubmitted && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                  <ResultsView promptId={prompt.id} />
                </motion.div>
              )}

              {/* Next prompt */}
              {currentPhase === 'results' && isSubmitted && currentIdx < prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <Button onClick={goNext} className="w-full rounded-lg mt-5 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    Next prompt <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* All done */}
              {allDone && currentPhase === 'results' && currentIdx === prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center mt-8 space-y-4">
                  <div className="text-3xl">🎉</div>
                  <p className="text-sm font-semibold text-foreground">You've completed today's prompts!</p>
                  <p className="text-xs text-muted-foreground">Check back later — results update as more players answer.</p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <Button className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <Link to="/results">View today's results</Link>
                    </Button>
                    <Button variant="outline" className="rounded-lg" asChild>
                      <Link to="/archive">Play archive</Link>
                    </Button>
                  </div>
                  <Countdown />
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIdx === 0} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIdx === prompts.length - 1} className="text-muted-foreground hover:text-foreground">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/50 tracking-wide">JINX — a party word game in development</p>
      </footer>
    </div>
  );
}
