import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Calendar, Send, Check, Loader2, ChevronRight, Zap } from 'lucide-react';
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
  const todayStr = new Date().toISOString().split('T')[0];

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
            <span className="text-xs text-muted-foreground ml-auto font-display">{selectedPrompt.date}</span>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-5 py-8">
          <div className="text-center mb-6">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-6 font-display">Archive Prompt</p>
            <div className="flex flex-col items-center gap-0 mb-6">
              <span className="font-display text-4xl font-bold text-foreground">{selectedPrompt.word_a}</span>
              <span className="text-primary text-xl font-display font-bold my-1.5">+</span>
              <span className="font-display text-4xl font-bold text-foreground">{selectedPrompt.word_b}</span>
            </div>
          </div>

          {!isSubmitted ? (
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-primary mb-0.5">What will most people say?</p>
              <p className="text-[11px] text-muted-foreground/60 mb-4">Match the crowd, not the "best" answer.</p>
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Your answer…" className="rounded-lg text-center font-display bg-background border-border h-12 text-base" maxLength={50} />
                <Button onClick={handleSubmit} disabled={!inputVal.trim() || submitting} size="icon" className="rounded-lg shrink-0 h-12 w-12">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-2">Single word answers work best</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">You chose <span className="font-display font-bold text-foreground">{userAnswers[selectedPrompt.id]?.raw_answer}</span></span>
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
              <Link to="/results">Results</Link>
            </Button>
            <Button size="sm" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 text-sm" asChild>
              <Link to="/play">Play today</Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground mb-1">Archive</h1>
          <p className="text-xs text-muted-foreground">Explore past prompts and see how the crowd answered.</p>
        </div>

        {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => {
          const isToday = date === todayStr;
          return (
            <div key={date} className="mb-8">
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className={`text-xs font-display font-semibold ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {isToday && (
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-display font-bold flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> Live
                  </span>
                )}
              </div>

              {/* Prompt cards */}
              <div className="space-y-2">
                {ps.map((p, i) => {
                  const answered = submittedMap[p.id];
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelected(p.id)}
                      className={`game-card w-full text-left flex items-center justify-between transition-all group ${
                        isToday ? 'hover:border-primary/40 hover:shadow-sm' : 'hover:border-primary/20'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-foreground text-sm">
                          {p.word_a} <span className="text-primary/60">+</span> {p.word_b}
                        </p>
                        {answered && userAnswers[p.id] && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            → <span className="font-display font-semibold text-foreground">{userAnswers[p.id].raw_answer}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        {answered && <Check className="h-3.5 w-3.5 text-primary" />}
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                          <Users className="h-3 w-3" />
                          {totalCounts[p.id] ?? 0}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/50 transition-colors" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
