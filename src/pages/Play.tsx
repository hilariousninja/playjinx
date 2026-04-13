import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, Zap } from 'lucide-react';
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

      const currentIdx = prompts.findIndex(pp => pp.id === promptId);
      const nextIdx = prompts.findIndex((p, i) => i > currentIdx && !submitted[p.id] && p.id !== promptId);
      if (nextIdx >= 0) {
        setActiveIdx(nextIdx);
        setTimeout(() => inputRefs.current[prompts[nextIdx].id]?.focus(), 100);
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
      <div className="max-w-md mx-auto w-full px-4 pt-3 pb-2">
        <h1 className="text-[17px] font-semibold text-foreground tracking-tight">Today's prompts</h1>
        <p className="text-[11px] text-muted-foreground mt-[1px]">What word links both?</p>
      </div>

      {/* Prompt cards — v8 style */}
      <div className="flex-1 px-4 pb-6 max-w-md mx-auto w-full space-y-[9px]">
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
              className={`bg-card rounded-[14px] border transition-all ${
                isActive
                  ? 'border-primary bg-[#FFFBF3] p-[15px_16px]'
                  : isDone
                    ? 'border-foreground/[0.08] p-[15px_16px] opacity-85'
                    : 'border-foreground/[0.08] p-[15px_16px] opacity-60'
              }`}
              onClick={() => {
                if (isInactive) setActiveIdx(i);
              }}
            >
              {/* Number label with rule line */}
              <div className="flex items-center gap-[6px] mb-2 text-[10px] font-medium text-muted-foreground tracking-[0.05em]">
                {String(i + 1).padStart(2, '0')}
                <div className="flex-1 h-px bg-foreground/[0.08]" />
              </div>

              {/* Word pair + answer as inline relationship */}
              {isActive ? (
                <div>
                  {/* Word pair */}
                  <div className="flex items-center gap-[9px] mb-[10px]">
                    <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                      {p.word_a}
                    </span>
                    <span className="text-[14px] text-primary/50">+</span>
                    <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                      {p.word_b}
                    </span>
                  </div>

                  {/* Answer input */}
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
                    {submittingId === p.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-[6px] italic">
                    Pick the one most people will say.
                  </p>
                  {inputErrors[p.id] && (
                    <p className="text-[11px] text-destructive mt-1">{inputErrors[p.id]}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center mb-[11px]">
                  <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                    {p.word_a}
                  </span>
                  <span className="text-[14px] text-border mx-[9px]">+</span>
                  <span className="text-[26px] font-bold tracking-[-0.02em] text-foreground leading-none">
                    {p.word_b}
                  </span>
                </div>
              )}

              {/* Done state — green answer with check */}
              {isDone && userAnswers[p.id] && (
                <div className="flex items-center justify-between pb-[6px] border-b-[1.5px] border-[hsl(var(--success))]/20">
                  <span className="text-[18px] font-semibold text-[hsl(var(--success))]">
                    {userAnswers[p.id].raw_answer}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" fill="hsl(var(--success) / 0.08)" />
                    <path d="M4 7l2 2 4-4" stroke="hsl(var(--success))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              {/* Inactive — clearly unanswered */}
              {isInactive && (
                <div
                  className="pb-[6px] border-b-[1.5px] border-dashed border-foreground/10 cursor-pointer"
                  onClick={() => setActiveIdx(i)}
                >
                  <span className="text-[12px] text-foreground/20 italic">Tap to answer…</span>
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
