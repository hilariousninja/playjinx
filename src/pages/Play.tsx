import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, Zap } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  ensureDailyPrompts, submitAnswer, getBatchUserAnswers,
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
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!hasSeenOnboarding()) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    (async () => {
      const ps = await ensureDailyPrompts();
      setPrompts(ps);

      const localCompleted = getCompletedPrompts();
      const allIds = ps.map(p => p.id);
      const { submittedMap: serverMap, answerMap: batchAnswers } = await getBatchUserAnswers(allIds);

      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      for (const p of ps) {
        const localSubmitted = localCompleted.has(p.id);
        const didSubmit = serverMap[p.id] || localSubmitted;
        subMap[p.id] = didSubmit;
        if (didSubmit && batchAnswers[p.id]) {
          ansMap[p.id] = batchAnswers[p.id];
          if (!localSubmitted) markPromptCompleted(p.id);
        }
      }

      setSubmitted(subMap);
      setUserAnswers(ansMap);

      const firstUnanswered = ps.findIndex(p => !subMap[p.id]);
      if (firstUnanswered >= 0) setActiveIdx(firstUnanswered);
      else setActiveIdx(ps.length - 1);

      requestAnimationFrame(() => setLoading(false));
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

      const currentIdx = prompts.findIndex(pp => pp.id === promptId);
      const nextIdx = prompts.findIndex((p, i) => i > currentIdx && !submitted[p.id] && p.id !== promptId);
      if (nextIdx >= 0) {
        setActiveIdx(nextIdx);
        setTimeout(() => {
          const nextId = prompts[nextIdx].id;
          inputRefs.current[nextId]?.focus();
          if (isMobile && cardRefs.current[nextId]) {
            cardRefs.current[nextId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
    } catch (err: any) {
      setInputErrors(prev => ({ ...prev, [promptId]: err?.message || 'Something went wrong' }));
    } finally {
      setSubmittingId(null);
    }
  }, [answers, submitted, submittingId, prompts, isMobile]);

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
      <div className="max-w-md mx-auto w-full px-4 pt-3 pb-2">
        <h1 className="text-[17px] font-semibold text-foreground tracking-tight">Today's prompts</h1>
        <p className="text-[11px] text-muted-foreground mt-[1px]">What word links both?</p>
      </div>

      {/* Prompt cards */}
      <div className="flex-1 px-4 pb-6 max-w-md mx-auto w-full space-y-[9px]">
        {prompts.map((p, i) => {
          const isDone = submitted[p.id];
          const isActive = i === activeIdx && !isDone;
          const isInactive = !isDone && !isActive;
          const draftText = answers[p.id]?.trim();

          return (
            <motion.div
              key={p.id}
              ref={(el) => { cardRefs.current[p.id] = el; }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`bg-card rounded-[14px] border transition-all ${
                isActive
                  ? 'border-primary bg-[#FFFBF3] p-[15px_16px] scroll-mt-3'
                  : isDone
                    ? 'border-[hsl(var(--success))]/15 bg-[hsl(var(--success))]/[0.02] p-[12px_16px]'
                    : 'border-foreground/[0.06] p-[12px_16px] opacity-60'
              }`}
              onClick={() => {
                if (isInactive) {
                  setActiveIdx(i);
                  if (isMobile && cardRefs.current[p.id]) {
                    setTimeout(() => cardRefs.current[p.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }
                }
              }}
            >
              {/* Number label with rule line */}
              <div className="flex items-center gap-[6px] mb-2 text-[10px] font-medium text-muted-foreground tracking-[0.05em]">
                {String(i + 1).padStart(2, '0')}
                <div className="flex-1 h-px bg-foreground/[0.08]" />
                {isDone && (
                  <span className="text-[9px] font-semibold text-[hsl(var(--success))] uppercase tracking-wider">Submitted</span>
                )}
              </div>

              {/* Active: full input */}
              {isActive ? (
                <div>
                  <div className="flex items-center gap-[9px] mb-[10px]">
                    <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                      {p.word_a}
                    </span>
                    <span className="text-[14px] text-primary/50">+</span>
                    <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                      {p.word_b}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 border-b-[1.5px] border-primary/60 pb-[3px]">
                      <input
                        ref={(el) => { inputRefs.current[p.id] = el; }}
                        value={answers[p.id] || ''}
                        onChange={e => {
                          setAnswers(prev => ({ ...prev, [p.id]: e.target.value }));
                          setInputErrors(prev => ({ ...prev, [p.id]: '' }));
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit(p.id)}
                        placeholder="Your linking word"
                        className="bg-transparent text-[17px] font-semibold text-primary placeholder:text-primary/25 placeholder:font-normal focus:outline-none w-full"
                        maxLength={80}
                        disabled={!!submittingId}
                        autoFocus={i === activeIdx}
                      />
                    </div>
                    <button
                      onClick={() => handleSubmit(p.id)}
                      disabled={!!submittingId || !draftText}
                      className="text-[12px] font-semibold text-white bg-primary px-[12px] py-[6px] rounded-[8px] disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 transition-transform"
                    >
                      {submittingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit'}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-[6px] italic">
                    Pick the one most people will say.
                  </p>
                  {inputErrors[p.id] && (
                    <p className="text-[11px] text-destructive mt-1">{inputErrors[p.id]}</p>
                  )}
                </div>
              ) : isDone ? (
                /* Done: compact word pair + locked answer */
                <div>
                  <div className="flex items-center gap-[7px] mb-[6px]">
                    <span className="text-[16px] font-semibold tracking-[-0.01em] text-foreground/50 leading-none">
                      {p.word_a}
                    </span>
                    <span className="text-[11px] text-foreground/20">+</span>
                    <span className="text-[16px] font-semibold tracking-[-0.01em] text-foreground/50 leading-none">
                      {p.word_b}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-[hsl(var(--success))]">
                      {userAnswers[p.id]?.raw_answer}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6.5" fill="hsl(var(--success) / 0.1)" />
                      <path d="M4 7l2 2 4-4" stroke="hsl(var(--success))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              ) : (
                /* Inactive: word pair + draft preview if exists */
                <div>
                  <div className="flex items-center mb-[8px]">
                    <span className="text-[22px] font-bold tracking-[-0.02em] text-foreground/70 leading-none">
                      {p.word_a}
                    </span>
                    <span className="text-[12px] text-foreground/15 mx-[8px]">+</span>
                    <span className="text-[22px] font-bold tracking-[-0.02em] text-foreground/70 leading-none">
                      {p.word_b}
                    </span>
                  </div>

                  {draftText ? (
                    /* Draft indicator — shows typed-but-not-submitted text */
                    <div
                      className="pb-[4px] border-b border-dashed border-primary/30 cursor-pointer"
                      onClick={() => setActiveIdx(i)}
                    >
                      <div className="flex items-center gap-[6px]">
                        <span className="text-[14px] font-medium text-primary/60">{draftText}</span>
                        <span className="text-[9px] font-medium text-primary/40 bg-primary/8 px-[5px] py-[1px] rounded">draft</span>
                      </div>
                      <span className="text-[10px] text-primary/35 italic mt-[2px] block">Tap to submit</span>
                    </div>
                  ) : (
                    <div
                      className="pb-[4px] border-b border-dashed border-foreground/[0.06] cursor-pointer group/tap hover:border-primary/20 transition-colors"
                      onClick={() => setActiveIdx(i)}
                    >
                      <span className="text-[11px] text-foreground/15 italic group-hover/tap:text-primary/30 transition-colors">Tap to answer…</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {/* See results CTA */}
        {allDone && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="pt-1">
            <button
              onClick={handleSeeResults}
              className="w-full py-[14px] bg-primary text-white border-none rounded-[13px] text-[14px] font-semibold cursor-pointer active:scale-[0.97] transition-transform"
            >
              See my results →
            </button>
          </motion.div>
        )}
      </div>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
