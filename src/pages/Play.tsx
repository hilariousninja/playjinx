import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getDailyPrompts, hasSubmitted, submitAnswer, getUserAnswer, type DbPrompt, type DbAnswer } from '@/lib/store';
import ResultsView from '@/components/ResultsView';

export default function Play() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<string, DbAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const ps = await getDailyPrompts();
      setPrompts(ps);
      const subMap: Record<string, boolean> = {};
      const ansMap: Record<string, DbAnswer> = {};
      await Promise.all(ps.map(async (p) => {
        subMap[p.id] = await hasSubmitted(p.id);
        const ua = await getUserAnswer(p.id);
        if (ua) ansMap[p.id] = ua;
      }));
      setSubmitted(subMap);
      setUserAnswers(ansMap);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (prompts.length === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">No prompts for today yet.</p>
        <Button asChild><Link to="/">Home</Link></Button>
      </div>
    </div>
  );

  const prompt = prompts[currentIdx];
  const isSubmitted = submitted[prompt.id];

  const handleSubmit = async () => {
    if (!inputVal.trim() || isSubmitted || submitting) return;
    setSubmitting(true);
    try {
      const answer = await submitAnswer(prompt.id, inputVal.trim());
      setSubmitted(prev => ({ ...prev, [prompt.id]: true }));
      setUserAnswers(prev => ({ ...prev, [prompt.id]: answer }));
      setInputVal('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">JINX</Link>
          <span className="text-sm text-muted-foreground font-display">{currentIdx + 1} / {prompts.length}</span>
        </div>
      </nav>

      <div className="container max-w-lg py-8">
        <div className="flex justify-center gap-2 mb-8">
          {prompts.map((p, i) => (
            <button key={p.id} onClick={() => setCurrentIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentIdx ? 'bg-primary' : submitted[p.id] ? 'bg-muted-foreground' : 'bg-muted'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={prompt.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <div className="game-card text-center mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Find the bridge word</p>
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="font-display text-2xl md:text-3xl font-bold">{prompt.word_a}</span>
                <span className="text-muted-foreground text-xl">+</span>
                <span className="font-display text-2xl md:text-3xl font-bold">{prompt.word_b}</span>
              </div>

              {!isSubmitted ? (
                <div className="flex gap-2 max-w-xs mx-auto">
                  <Input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Your answer..." className="rounded-2xl text-center font-display bg-secondary border-border" maxLength={50} />
                  <Button onClick={handleSubmit} disabled={!inputVal.trim() || submitting} size="icon" className="rounded-2xl shrink-0">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-keep" />
                  <span className="text-sm">Submitted: <span className="font-display font-semibold text-foreground">{userAnswers[prompt.id]?.raw_answer}</span></span>
                </div>
              )}
            </div>

            {isSubmitted && <ResultsView promptId={prompt.id} />}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          <Button variant="ghost" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentIdx(i => Math.min(prompts.length - 1, i + 1))} disabled={currentIdx === prompts.length - 1}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
