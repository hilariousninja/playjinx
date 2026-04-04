import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2, Zap, Users, BarChart3, Share2 } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ensureDailyPrompts, hasSubmitted, submitAnswer, getUserAnswer, getTotalSubmissions, getCompletedPrompts, markPromptCompleted, type DbPrompt, type DbAnswer } from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import ResultsView from '@/components/ResultsView';
import Countdown from '@/components/Countdown';
import SocialMemoryCard from '@/components/SocialMemoryCard';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import Onboarding, { hasSeenOnboarding } from '@/components/Onboarding';
import { createChallenge, buildChallengeShareText, getChallengeByToken } from '@/lib/challenge';
import { getDisplayName, joinChallengeRoom } from '@/lib/challenge-room';
import { toast } from '@/hooks/use-toast';

type Phase = 'input' | 'calculating' | 'results';

export default function Play() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const challengeToken = searchParams.get('challenge');
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
    if (validationError) { setInputError(validationError); return; }
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

        // If playing via challenge and all prompts now done, redirect to comparison
        if (challengeToken) {
          const newSubmitted = { ...submitted, [prompt.id]: true };
          const nowAllDone = prompts.every(p => newSubmitted[p.id]);
          if (nowAllDone) {
            setTimeout(() => navigate(`/c/${challengeToken}/compare`), 800);
          }
        }
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
      <AnimatePresence>
        {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <div className="flex items-center gap-3">
            <PlayerIdentity />
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
                <Link to="/archive">
                  <BarChart3 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className={`flex-1 flex flex-col items-center ${isSubmitted && currentPhase === 'results' ? 'pt-[5vh] md:pt-[6vh]' : 'pt-[12vh] md:pt-[14vh]'} transition-all duration-300`}>
        <div className="w-full max-w-[22rem] mx-auto px-5">
          <AnimatePresence mode="wait">
            <motion.div key={prompt.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>

              {currentPhase === 'input' && !isSubmitted ? (
                <div className="text-center">
                  <div className="mb-4">
                    <PromptPair wordA={prompt.word_a} wordB={prompt.word_b} size="lg" />
                  </div>
                  <p className="text-[14px] font-bold text-primary mb-7">What will most people say?</p>
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
                  {inputError && <p className="text-[11px] text-destructive mt-2">{inputError}</p>}
                  {(playerCounts[prompt.id] ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground/50 flex items-center justify-center gap-1.5 mt-5">
                      <Users className="h-3 w-3" />
                      {playerCounts[prompt.id]} players answered
                    </p>
                  )}
                </div>
              ) : isSubmitted && currentPhase !== 'calculating' && currentPhase !== 'results' ? (
                <div className="text-center">
                  <div className="mb-3">
                    <PromptPair wordA={prompt.word_a} wordB={prompt.word_b} size="lg" />
                  </div>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 bg-primary/8 text-primary px-5 py-2 rounded-full mt-2">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-sm font-display font-bold">{userAnswers[prompt.id]?.raw_answer}</span>
                  </motion.div>
                </div>
              ) : null}

              {currentPhase === 'calculating' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10 space-y-3">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm text-foreground font-display font-semibold">Finding matches…</p>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-[10px] text-muted-foreground/50">Comparing with other players</motion.p>
                </motion.div>
              )}

              {currentPhase === 'results' && isSubmitted && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-4">
                  <ResultsView promptId={prompt.id} />

                  {currentIdx < prompts.length - 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4">
                      <Button onClick={goNext} className="w-full rounded-xl h-10 font-semibold text-sm active:scale-[0.97] transition-transform">
                        Next prompt <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </motion.div>
                  )}

                  {allDone && !challengeToken && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4 text-center space-y-2.5">
                      <Button
                        className="w-full rounded-xl h-10 font-semibold text-sm active:scale-[0.97] transition-transform"
                        onClick={async () => {
                          try {
                            const ch = await createChallenge(prompts);
                            const text = buildChallengeShareText(prompts, ch.token);
                            if (navigator.share) {
                              try { await navigator.share({ text }); return; } catch {}
                            }
                            await navigator.clipboard.writeText(text);
                            toast({ title: 'Challenge copied!', description: 'Share it with your friends' });
                          } catch {
                            toast({ title: 'Could not create challenge', variant: 'destructive' });
                          }
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5 mr-2" /> Challenge a friend
                      </Button>
                      <Button variant="outline" className="w-full rounded-xl h-9 text-xs" asChild>
                        <Link to="/archive">View all results</Link>
                      </Button>
                      {currentIdx === prompts.length - 1 && <Countdown />}
                      {currentIdx === prompts.length - 1 && (
                        <div className="mt-3">
                          <SocialMemoryCard compact />
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {showBottomNav && (
            <div className="flex justify-between mt-6">
              <button onClick={goPrev} disabled={currentIdx === 0} className="text-[10px] uppercase tracking-wide text-muted-foreground/30 hover:text-muted-foreground disabled:opacity-0 transition-all flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Prev
              </button>
              <button onClick={goNext} disabled={currentIdx === prompts.length - 1} className="text-[10px] uppercase tracking-wide text-muted-foreground/30 hover:text-muted-foreground disabled:opacity-0 transition-all flex items-center gap-1">
                Next <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
