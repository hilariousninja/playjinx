import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, Zap, CornerDownLeft } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import {
  ensureDailyPrompts, hasSubmitted, submitAnswer, getUserAnswer,
  getTotalSubmissions, getCompletedPrompts, markPromptCompleted,
  type DbPrompt, type DbAnswer,
} from '@/lib/store';
import { validateInput } from '@/lib/normalize';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Onboarding, { hasSeenOnboarding } from '@/components/Onboarding';
import { getChallengeByToken } from '@/lib/challenge';
import { recordMatchesForChallenge } from '@/lib/social-memory';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';
import { toast } from '@/hooks/use-toast';

export default function Play() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const challengeToken = searchParams.get('challenge');
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();

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
      }));

      setSubmitted(subMap);
      setUserAnswers(ansMap);

      const firstUnanswered = ps.findIndex(p => !subMap[p.id]);
      if (firstUnanswered >= 0) setActiveIdx(firstUnanswered);
      else setActiveIdx(ps.length - 1);

      setLoading(false);
    })();
  }, []);

  const handleSubmit = useCallback(async (promptId: string) => {
    const trimmed = (answers[promptId] || '').trim();
    const validationError = validateInput(trimmed);
    if (validationError) {
      setInputErrors(prev => ({ ...prev, [promptId]: validationError }));
      return;
    }
    if (submitted[promptId] || submittingId) return;

    setSubmittingId(promptId);
    setInputErrors(prev => ({ ...prev, [promptId]: '' }));
    try {
      const answer = await submitAnswer(promptId, trimmed);
      setSubmitted(prev => ({ ...prev, [promptId]: true }));
      setUserAnswers(prev => ({ ...prev, [promptId]: answer }));
      markPromptCompleted(promptId);

      const nextIdx = prompts.findIndex((p, i) => i > prompts.findIndex(pp => pp.id === promptId) && !submitted[p.id] && p.id !== promptId);
      if (nextIdx >= 0) {
        setActiveIdx(nextIdx);
      }
    } catch (err: any) {
      setInputErrors(prev => ({ ...prev, [promptId]: err?.message || 'Something went wrong' }));
    } finally {
      setSubmittingId(null);
    }
  }, [answers, submitted, submittingId, prompts]);

  const allDone = prompts.length > 0 && prompts.every(p => submitted[p.id]);

  const handleSeeResults = async () => {
    if (challengeToken) {
      try {
        const ch = await getChallengeByToken(challengeToken);
        if (ch) await recordMatchesForChallenge(ch.id);
      } catch {}
      navigate(`/c/${challengeToken}/compare`);
    } else {
      navigate('/results');
    }
  };

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
        <Button className="rounded-xl" asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}

      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      {/* Title area */}
      <div className="text-center pt-6 pb-4 px-5">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-0.5">Today's prompts</h1>
        <p className="text-[12px] text-muted-foreground/60">What word will most people say?</p>
      </div>

      {/* Prompt cards */}
      <div className="flex-1 px-5 pb-6 max-w-md mx-auto w-full space-y-3">
        {prompts.map((p, i) => {
          const isDone = submitted[p.id];
          const isActive = i === activeIdx && !isDone;
          const isInactive = !isDone && !isActive;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl transition-all ${
                isDone
                  ? 'bg-card border border-[hsl(var(--success))]/15 p-4'
                  : isActive
                    ? 'game-card-elevated p-5'
                    : 'bg-card border border-border/30 p-4 opacity-50'
              }`}
              onClick={() => {
                if (isInactive) setActiveIdx(i);
              }}
            >
              {/* Number label */}
              <p className={`text-[9px] font-display font-bold uppercase tracking-[0.15em] mb-2 ${
                isDone ? 'text-[hsl(var(--success))]/70' : isActive ? 'text-primary/60' : 'text-muted-foreground/30'
              }`}>
                Prompt {i + 1}
              </p>

              {/* Word pair */}
              <div className={isDone ? 'mb-2' : 'mb-4'}>
                <PromptPair
                  wordA={p.word_a}
                  wordB={p.word_b}
                  size={isActive ? 'md' : 'sm'}
                  className={isDone ? 'opacity-60' : ''}
                />
              </div>

              {/* Done state */}
              {isDone && userAnswers[p.id] && (
                <div className="flex items-center justify-center gap-2 py-1">
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]/70" />
                  <span className="text-[15px] font-bold text-foreground/80 tracking-tight">
                    {userAnswers[p.id].raw_answer}
                  </span>
                </div>
              )}

              {/* Active input */}
              {isActive && (
                <div>
                  <div className="relative">
                    <input
                      ref={(el) => { inputRefs.current[p.id] = el; }}
                      value={answers[p.id] || ''}
                      onChange={e => {
                        setAnswers(prev => ({ ...prev, [p.id]: e.target.value }));
                        setInputErrors(prev => ({ ...prev, [p.id]: '' }));
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit(p.id)}
                      placeholder="Type your answer…"
                      className="w-full rounded-xl text-center font-bold bg-background/80 h-[52px] text-lg border border-border/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/25 transition-colors"
                      maxLength={80}
                      disabled={!!submittingId}
                    />
                  </div>

                  {/* Submit button — full width below input */}
                  <Button
                    onClick={() => handleSubmit(p.id)}
                    disabled={!(answers[p.id] || '').trim() || !!submittingId}
                    className="w-full mt-2.5 rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-30"
                  >
                    {submittingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Submit <CornerDownLeft className="h-3.5 w-3.5 ml-1.5 opacity-50" /></>
                    )}
                  </Button>

                  {inputErrors[p.id] && (
                    <p className="text-[11px] text-destructive mt-1.5 text-center">{inputErrors[p.id]}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/40 text-center mt-2.5">
                    Not the cleverest — the most common.
                  </p>
                </div>
              )}

              {/* Inactive — tap to activate */}
              {isInactive && (
                <p className="text-[11px] text-muted-foreground/25 text-center cursor-pointer py-1">
                  Tap to answer
                </p>
              )}
            </motion.div>
          );
        })}

        {/* See results CTA */}
        {allDone && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="pt-2">
            <Button
              onClick={handleSeeResults}
              size="lg"
              className="w-full rounded-xl h-[52px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[15px] active:scale-[0.97] transition-transform shadow-sm shadow-primary/20"
            >
              See my results <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </div>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}