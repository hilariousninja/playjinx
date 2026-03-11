import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getArchivePrompts, hasSubmitted, getTotalSubmissions, submitAnswer, getUserAnswer } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Send, Check } from 'lucide-react';
import ResultsView from '@/components/ResultsView';

export default function Archive() {
  const prompts = getArchivePrompts();
  const [selected, setSelected] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>(
    Object.fromEntries(prompts.map(p => [p.id, hasSubmitted(p.id)]))
  );

  const grouped = prompts.reduce<Record<string, typeof prompts>>((acc, p) => {
    (acc[p.date] = acc[p.date] || []).push(p);
    return acc;
  }, {});

  const selectedPrompt = prompts.find(p => p.id === selected);

  const handleSubmit = () => {
    if (!selected || !inputVal.trim() || submittedMap[selected]) return;
    submitAnswer(selected, inputVal.trim());
    setSubmittedMap(prev => ({ ...prev, [selected]: true }));
    setInputVal('');
  };

  if (selectedPrompt) {
    const isSubmitted = submittedMap[selectedPrompt.id];
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border">
          <div className="container flex items-center h-14 gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-lg font-bold">JINX</span>
            <span className="text-xs text-muted-foreground ml-auto">{selectedPrompt.date}</span>
          </div>
        </nav>
        <div className="container max-w-lg py-8">
          <div className="game-card text-center mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Archive Prompt</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="font-display text-2xl font-bold">{selectedPrompt.word_a}</span>
              <span className="text-muted-foreground text-xl">+</span>
              <span className="font-display text-2xl font-bold">{selectedPrompt.word_b}</span>
            </div>
            {!isSubmitted ? (
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Your answer..."
                  className="rounded-2xl text-center font-display bg-secondary border-border"
                  maxLength={50}
                />
                <Button onClick={handleSubmit} disabled={!inputVal.trim()} size="icon" className="rounded-2xl shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-keep" />
                <span className="text-sm">Submitted: <span className="font-display font-semibold text-foreground">{getUserAnswer(selectedPrompt.id)?.raw_answer}</span></span>
              </div>
            )}
          </div>
          {isSubmitted && <ResultsView promptId={selectedPrompt.id} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">JINX</Link>
          <Button size="sm" asChild><Link to="/play">Play today</Link></Button>
        </div>
      </nav>
      <div className="container max-w-lg py-8">
        <h1 className="text-2xl font-bold mb-6">Archive</h1>
        {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, ps]) => (
          <div key={date} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-display">{date}</span>
            </div>
            <div className="space-y-2">
              {ps.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(p.id)}
                  className="game-card w-full text-left flex items-center justify-between hover:border-muted-foreground/30 transition-colors"
                >
                  <div>
                    <span className="font-display font-semibold">{p.word_a}</span>
                    <span className="text-muted-foreground mx-2">+</span>
                    <span className="font-display font-semibold">{p.word_b}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{getTotalSubmissions(p.id)}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
