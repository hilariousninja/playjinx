import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Users, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  { num: '01', title: 'See the prompt', desc: 'Two words appear. Find the bridge.' },
  { num: '02', title: 'Submit once', desc: 'One answer. No take-backs.' },
  { num: '03', title: 'Watch clusters form', desc: 'See what everyone else picked.' },
  { num: '04', title: 'Climb the percentile', desc: 'Match the crowd, rank higher.' },
];

const features = [
  { icon: BarChart3, title: '3 Daily Prompts', desc: 'Fresh challenges every day' },
  { icon: Users, title: 'Live Results', desc: 'See answer clusters form in real time' },
  { icon: Trophy, title: 'Percentile Ranking', desc: 'Find out where you stand' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <span className="font-display text-lg font-bold tracking-tight">JINX</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/archive">Archive</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/play">Play</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-20 md:py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-display tracking-widest text-muted-foreground uppercase mb-4">Daily Word Game</p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            JINX<span className="text-muted-foreground font-light ml-2">Daily</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto mb-2">
            Think the same. Rank higher.
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-10">
            Find the bridge-word everyone else will pick.
          </p>
          <div className="flex gap-3 justify-center">
            <Button size="lg" className="rounded-2xl px-8" asChild>
              <Link to="/play">
                Play today <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-2xl px-8" asChild>
              <Link to="/archive">Browse archive</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="game-card text-center"
            >
              <f.icon className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
        <div className="grid md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="text-center"
            >
              <span className="font-display text-3xl font-bold text-muted-foreground/30">{s.num}</span>
              <h3 className="font-semibold mt-2 mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container text-center text-xs text-muted-foreground">
          JINX Daily · A word game experiment
        </div>
      </footer>
    </div>
  );
}
