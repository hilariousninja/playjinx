import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, syncCompletionStatus, type DbPrompt } from '@/lib/store';
import Countdown from '@/components/Countdown';
import JinxLogo from '@/components/JinxLogo';

export default function Landing() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const ps = await ensureDailyPrompts();
      setPrompts(ps);
      const statusMap = await syncCompletionStatus(ps);
      const completed = new Set(Object.entries(statusMap).filter(([, v]) => v).map(([k]) => k));
      setCompletedIds(completed);
      setLoaded(true);

      const allDone = ps.length > 0 && ps.every(p => statusMap[p.id]);
      if (allDone) {
        navigate('/results', { replace: true });
      }
    })();
  }, [navigate]);

  const allDone = loaded && prompts.length > 0 && prompts.every(p => completedIds.has(p.id));
  const someStarted = loaded && prompts.some(p => completedIds.has(p.id));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto flex items-center justify-between h-14 px-5">
          <Link to="/">
            <JinxLogo size={22} className="text-foreground text-lg" />
          </Link>
          <div className="flex items-center gap-1">
            {someStarted && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
                <Link to="/results">Results</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
            {!allDone && (
              <Button size="sm" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold px-4" asChild>
                <Link to="/play">Play</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-md py-16"
        >
          <p className="text-[11px] font-display tracking-[0.3em] text-muted-foreground uppercase mb-6">Daily Crowd Word Game</p>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-foreground mb-6">
            JINX
          </h1>

          <p className="text-base text-foreground/80 max-w-xs mx-auto font-semibold leading-relaxed">
            Think the same. Rank higher.
          </p>

          <p className="text-sm text-muted-foreground max-w-[17rem] mx-auto mt-5 leading-relaxed">
            See two words. Type the one bridge word you think most people will pick.
          </p>

          <p className="text-xs text-muted-foreground/50 max-w-[17rem] mx-auto mt-3 mb-12 leading-relaxed">
            You're not trying to be correct — you're trying to match the crowd.
          </p>

          {/* Completed state */}
          {allDone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="game-card-elevated inline-block px-8 py-7 mb-6"
            >
              <CheckCircle2 className="h-7 w-7 text-primary mx-auto mb-3" />
              <p className="font-semibold text-base mb-1 text-foreground">You've completed today's prompts</p>
              <p className="text-xs text-muted-foreground mb-6">Results update live — check back later to see rank changes.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" className="rounded-lg px-6 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" asChild>
                  <Link to="/results">
                    <Eye className="h-4 w-4 mr-2" /> View today's results
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-lg px-6 h-12" asChild>
                  <Link to="/archive">Play archive</Link>
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Example prompt */}
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="game-card-elevated inline-block px-12 py-7 mb-10"
              >
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.2em] font-display mb-4">Example prompt</p>
                <div className="flex flex-col items-center gap-0.5 font-display">
                  <span className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">COW</span>
                  <span className="text-primary text-lg font-bold my-0.5">+</span>
                  <span className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">SNOW</span>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-muted-foreground/50 text-sm">→</span>
                    <span className="text-primary text-lg font-bold tracking-tight">Milk</span>
                  </div>
                </div>
              </motion.div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" className="rounded-lg px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base" asChild>
                  <Link to="/play">
                    {someStarted ? 'Continue playing' : 'Play today'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {someStarted && (
                  <Button size="lg" variant="outline" className="rounded-lg px-6 h-12" asChild>
                    <Link to="/results">View results</Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* How it works */}
      <section className="border-t border-border py-16 px-5">
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-bold text-center mb-10 tracking-tight text-foreground">How it works</h2>
          <div className="grid grid-cols-2 gap-8">
            {[
              { num: '1', title: 'See the prompt', desc: 'Two words appear.' },
              { num: '2', title: 'Submit one word', desc: 'Guess one bridge word.' },
              { num: '3', title: 'See the crowd\'s answers', desc: 'Watch the clusters form.' },
              { num: '4', title: 'Rank higher', desc: 'Match the crowd.' },
            ].map((s) => (
              <div key={s.num} className="text-center">
                <span className="font-display text-2xl font-bold text-primary/30">{s.num}</span>
                <h3 className="font-semibold mt-1 mb-0.5 text-sm text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-5 space-y-2 px-5">
        <Countdown />
        <p className="text-center text-[10px] text-muted-foreground/40 tracking-wide">
          JINX — daily crowd word game
        </p>
      </footer>
    </div>
  );
}
