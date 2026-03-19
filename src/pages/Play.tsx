import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2, Zap, Users, BarChart3, Trophy } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
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
  const showBottomNav = isSubmitted && currentPhase === 'results';

  const goNext = () => { setCurrentIdx(i => Math.min(prompts.length - 1, i + 1)); setInputVal(''); setInputError(null); };
  const goPrev = () => { setCurrentIdx(i => Math.max(0, i - 1)); setInputVal(''); setInputError(null); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Onboarding overlay */}
      <AnimatePresence>
        {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {prompts.map((p, i) => (
                <button key={p.id} onClick={() => { setCurrentIdx(i); setInputVal(''); setInputError(null); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIdx
                      ? 'w-5 h-1.5 bg-primary'
                      : submitted[p.id]
                        ? 'w-1.5 h-1.5 bg-primary/30'
                        : 'w-1.5 h-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-display tabular-nums">
              {completedCount}/{prompts.length}
            </span>
            {completedCount > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground/60 hover:text-foreground h-7 w-7 p-0" asChild>
                <Link to="/results">
                  <BarChart3 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-start justify-center pt-14 pb-28">
        <div className="w-full max-w-[28rem] mx-auto px-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >

              <p className="text-center text-[10px] text-muted-foreground/60 font-display tracking-[0.18em] uppercase mb-6">
                Prompt {currentIdx + 1} of {prompts.length}
              </p>

              {/* Prompt hero */}
              <PromptPair wordA={prompt.word_a} wordB={prompt.word_b} size="lg" />

              {/* Objective + Input */}
              {currentPhase === 'input' && !isSubmitted ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-primary mt-3 mb-8">
                    Think: what will MOST people say?
                  </p>
                  <div className="flex gap-2.5 max-w-sm mx-auto">
                    <Input
                      value={inputVal}
                      onChange={e => { setInputVal(e.target.value); setInputError(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      placeholder="Your answer…"
                      className={`rounded-xl text-center font-display bg-background h-11 text-[15px] focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/35 ${inputError ? 'border-destructive' : 'border-border'}`}
                      maxLength={80}
                      disabled={submitting}
                      autoFocus
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputVal.trim() || submitting}
                      size="icon"
                      className="rounded-xl shrink-0 h-11 w-11"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {inputError ? (
                    <p className="text-[11px] text-destructive mt-2">{inputError}</p>
                  ) : (
                    <div className="mt-7 space-y-0.5">
                      <p className="text-[10px] font-display font-medium text-muted-foreground/40 uppercase tracking-[0.12em]">Tips</p>
                      <p className="text-[11px] text-muted-foreground/35 leading-relaxed">Match the crowd, not the "best" answer.</p>
                      <p className="text-[11px] text-muted-foreground/35 leading-relaxed">Single words usually work best.</p>
                    </div>
                  )}
                </div>
              ) : isSubmitted && currentPhase !== 'calculating' ? (
                <div className="text-center mt-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full"
                  >
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-display font-bold">You chose: {userAnswers[prompt.id]?.raw_answer}</span>
                  </motion.div>
                </div>
              ) : null}

              {/* Player count — quieter */}
              {isSubmitted && (playerCounts[prompt.id] ?? 0) > 0 && currentPhase !== 'calculating' && (
                <p className="text-[10px] text-muted-foreground/30 text-center flex items-center justify-center gap-1 mt-3">
                  <Users className="h-2.5 w-2.5" />
                  {playerCounts[prompt.id]} responses so far
                </p>
              )}

              {/* Calculating */}
              {currentPhase === 'calculating' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12 space-y-3"
                >
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm text-foreground font-display font-semibold">Finding clusters…</p>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-[10px] text-muted-foreground/60">
                    Comparing with other players
                  </motion.p>
                </motion.div>
              )}

              {/* Results */}
              {currentPhase === 'results' && isSubmitted && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-8">
                  <ResultsView promptId={prompt.id} />
                </motion.div>
              )}

              {/* Next prompt */}
              {currentPhase === 'results' && isSubmitted && currentIdx < prompts.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <Button onClick={goNext} className="w-full rounded-lg h-12 font-semibold">
                    Next prompt <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* All done — polished end-of-run */}
              {allDone && currentPhase === 'results' && currentIdx === prompts.length - 1 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="pt-2">
                  <div className="game-card-elevated text-center py-8 px-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">All done for today!</h3>
                    <p className="text-xs text-muted-foreground mb-6 max-w-xs mx-auto">
                      Your results are live. Check back later — your rank may improve as more players answer.
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <Button className="rounded-lg font-semibold" asChild>
                        <Link to="/results">View today's results</Link>
                      </Button>
                      <Button variant="outline" className="rounded-lg" asChild>
                        <Link to="/archive">Play archive</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Countdown />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows — lightweight */}
          {showBottomNav && (
            <div className="flex justify-between mt-8">
              <button onClick={goPrev} disabled={currentIdx === 0} className="text-[10px] uppercase tracking-wide text-muted-foreground/35 hover:text-muted-foreground disabled:opacity-0 transition-all flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Prev
              </button>
              <button onClick={goNext} disabled={currentIdx === prompts.length - 1} className="text-[10px] uppercase tracking-wide text-muted-foreground/35 hover:text-muted-foreground disabled:opacity-0 transition-all flex items-center gap-1">
                Next <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
