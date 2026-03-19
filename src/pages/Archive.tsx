import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Calendar, Send, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getArchivePrompts, hasSubmitted, getTotalSubmissions, submitAnswer, getUserAnswer, type DbPrompt, type DbAnswer } from '@/lib/store';
import ResultsView from '@/components/ResultsView';
import JinxLogo from '@/components/JinxLogo';

export default function Archive() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
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

  const handleSubmit = async () => {
    if (!selected || !inputVal.trim() || submittedMap[selected] || submitting) return;
    setSubmitting(true);
    try {
      const answer = await submitAnswer(selected, inputVal.trim());
      setSubmittedMap(prev => ({ ...prev, [selected]: true }));
      setUserAnswers(prev => ({ ...prev, [selected]: answer }));
      setInputVal('');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (selectedPrompt) {
    const isSubmitted = submittedMap[selectedPrompt.id];
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="flex items-center h-14 gap-3 max-w-lg mx-auto px-5">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <JinxLogo size={18} className="text-foreground text-base" />
            <span className="text-xs text-muted-foreground ml-auto">{selectedPrompt.date}</span>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-5 py-8">
          <div className="text-center mb-6">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-6">Archive Prompt</p>
            <div className="flex flex-col items-center gap-0 mb-6">
              <span className="font-display text-4xl font-bold text-foreground">{selectedPrompt.word_a}</span>
              <span className="text-primary text-xl font-display font-bold my-1.5">+</span>
              <span className="font-display text-4xl font-bold text-foreground">{selectedPrompt.word_b}</span>
            </div>
          </div>

          {!isSubmitted ? (
            <div className="game-card-elevated text-center py-6 px-6 mb-6">
              <p className="text-sm font-semibold text-foreground mb-1">Enter the ONE word most players will also choose</p>
              <p className="text-xs text-muted-foreground mb-5">You are trying to match the crowd, not just find any valid link.</p>
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Enter your word..." className="rounded-lg text-center font-display bg-background border-border h-12 text-base" maxLength={50} />
                <Button onClick={handleSubmit} disabled={!inputVal.trim() || submitting} size="icon" className="rounded-lg shrink-0 h-12 w-12">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">Your answer: <span className="font-display font-bold text-foreground">{userAnswers[selectedPrompt.id]?.raw_answer}</span></span>
            </div>
          )}
          {isSubmitted && <ResultsView promptId={selectedPrompt.id} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={20} className="text-foreground text-lg" />
          </Link>
          <Button size="sm" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4" asChild>
            <Link to="/play">Play today</Link>
          </Button>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-5 py-8">
        <h1 className="text-xl font-bold mb-6 text-foreground">Archive</h1>
        {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => {
          const isToday = date === new Date().toISOString().split('T')[0];
          return (
          <div key={date} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-display">{isToday ? 'Today' : date}</span>
              {isToday && <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold">Live</span>}
            </div>
            <div className="space-y-2">
              {ps.map((p, i) => {
                const answered = submittedMap[p.id];
                return (
                <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(p.id)}
                  className="game-card w-full text-left flex items-center justify-between hover:border-primary/30 transition-colors"
                >
                  <div>
                    <span className="font-display font-semibold text-foreground">{p.word_a}</span>
                    <span className="text-muted-foreground mx-2">+</span>
                    <span className="font-display font-semibold text-foreground">{p.word_b}</span>
                    {answered && userAnswers[p.id] && (
                      <span className="text-[10px] text-muted-foreground ml-3">
                        → <span className="font-display font-semibold text-foreground">{userAnswers[p.id].raw_answer}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {answered && <Check className="h-3 w-3 text-primary" />}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{totalCounts[p.id] ?? 0}</span>
                    </div>
                  </div>
                </motion.button>
                );
              })}
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}
