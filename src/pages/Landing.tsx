import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Users, Trophy, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, type DbPrompt } from '@/lib/store';
import Countdown from '@/components/Countdown';

function getCompletedPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem('jinx_completed_prompts');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

const steps = [
  { num: '01', title: 'See the prompt', desc: 'Two words appear. Find the bridge.' },
  { num: '02', title: 'Submit once', desc: 'One answer. No take-backs.' },
  { num: '03', title: 'Watch clusters form', desc: 'See what everyone else picked.' },
  { num: '04', title: 'Climb the percentile', desc: 'Match the crowd, rank higher.' },
];

const features = [
  { icon: BarChart3, title: '3 Daily Prompts', desc: 'Fresh word pairs to solve' },
  { icon: Users, title: 'Live Results', desc: 'See answer clusters form in real time' },
  { icon: Trophy, title: 'Percentile Ranking', desc: 'Find out where you stand' },
];

export default function Landing() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const ps = await ensureDailyPrompts();
      setPrompts(ps);
      setCompletedIds(getCompletedPrompts());
      setLoaded(true);
    })();
  }, []);

  const allDone = loaded && prompts.length > 0 && prompts.every(p => completedIds.has(p.id));
  const someStarted = loaded && prompts.some(p => completedIds.has(p.id));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14 max-w-3xl mx-auto">
          <span className="font-display text-lg font-bold tracking-tight jinx-gradient-text">JINX</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
            <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link to="/play">Play</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container flex-1 flex items-center justify-center py-20 md:py-28 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center w-full"
        >
          <p className="text-[11px] font-display tracking-[0.4em] text-muted-foreground/60 uppercase mb-8">Daily Word Game</p>

          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-3">
            <span className="jinx-gradient-text">JINX</span>
          </h1>
          <p className="text-2xl md:text-3xl font-light text-muted-foreground/60 tracking-tight mb-4">
            Daily
          </p>

          <p className="text-base md:text-lg text-foreground/80 max-w-sm mx-auto mb-2 font-medium">
            Think the same. Rank higher.
          </p>
          <p className="text-sm text-muted-foreground/50 max-w-xs mx-auto mb-12">
            See two words. Type the ONE bridge-word you think everyone else will pick.
          </p>

          {/* Completed state */}
          {allDone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="game-card-elevated inline-block px-8 py-6 mb-10"
            >
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="font-display font-bold text-lg mb-1">You've completed today's prompts!</p>
              <p className="text-xs text-muted-foreground/60 mb-5">Results update live as more players answer.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" className="rounded-xl px-6 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" asChild>
                  <Link to="/results">
                    <Eye className="h-4 w-4 mr-2" /> View today's results
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl px-6 h-12 border-border/60" asChild>
                  <Link to="/archive">Play archive</Link>
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Example */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="game-card-elevated inline-block px-10 py-6 mb-12"
              >
                <div className="flex flex-col items-center gap-1 font-display">
                  <span className="text-2xl md:text-3xl font-bold">COW</span>
                  <span className="text-primary text-lg font-bold">+</span>
                  <span className="text-2xl md:text-3xl font-bold">SNOW</span>
                  <span className="text-muted-foreground/40 text-sm mt-2">→</span>
                  <span className="text-primary text-xl font-bold mt-1">Milk</span>
                </div>
              </motion.div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" className="rounded-xl px-8 h-13 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base" asChild>
                  <Link to="/play">
                    {someStarted ? 'Continue playing' : 'Play today'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {someStarted && (
                  <Button size="lg" variant="outline" className="rounded-xl px-6 h-13 border-border/60 hover:bg-secondary/80" asChild>
                    <Link to="/results">View results</Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="rounded-xl px-8 h-13 border-border/60 hover:bg-secondary/80 text-base" asChild>
                  <Link to="/archive">Browse archive</Link>
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </section>

      {/* Features */}
      <section className="container pb-20 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="game-card text-center py-8"
            >
              <f.icon className="h-5 w-5 mx-auto mb-3 text-primary/60" />
              <h3 className="font-semibold mb-1 text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground/60">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container pb-24 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-center mb-12 tracking-tight">How it works</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="text-center"
            >
              <span className="font-display text-3xl font-bold text-primary/20">{s.num}</span>
              <h3 className="font-semibold mt-2 mb-1 text-sm">{s.title}</h3>
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-5 mt-auto">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">
          JINX — a party word game in development
        </p>
      </footer>
    </div>
  );
}
