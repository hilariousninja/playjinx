import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, syncCompletionStatus, type DbPrompt } from '@/lib/store';
import Countdown from '@/components/Countdown';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { useGroupHasActivity } from '@/hooks/use-group-activity';

export default function Landing() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [someStarted, setSomeStarted] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const navigate = useNavigate();
  const hasNewRoomActivity = useRoomHasNewActivity();
  const hasGroupActivity = useGroupHasActivity();

  useEffect(() => {
    (async () => {
      const ps = await ensureDailyPrompts();
      setPrompts(ps);
      const statusMap = await syncCompletionStatus(ps);
      const completedCount = Object.values(statusMap).filter(Boolean).length;
      setSomeStarted(completedCount > 0);
      setAllDone(ps.length > 0 && completedCount === ps.length);
      setLoaded(true);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <main className="flex justify-center px-5 pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-md"
        >
          <p className="text-[9px] font-display tracking-[0.35em] text-muted-foreground/60 uppercase mb-4">
            Daily Crowd Word Game
          </p>
          <h1 className="text-7xl font-black tracking-[-0.06em] text-foreground mb-2 md:text-8xl leading-none">
            JINX
          </h1>
          <p className="text-[15px] text-primary font-bold mb-1.5 tracking-tight">
            Think the same. Rank higher.
          </p>
          <p className="text-[13px] text-muted-foreground/70 mx-auto mb-5 leading-relaxed max-w-[280px]">
            Three word pairs drop each day. Enter the word you think most people will say.
          </p>

          {/* Amber callout */}
          <div className="bg-primary/8 border border-primary/15 rounded-xl px-4 py-3 mb-6 max-w-xs mx-auto">
            <p className="text-[12px] text-primary font-bold tracking-tight">
              Not the cleverest answer — the most common one.
            </p>
          </div>

          {/* Example card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="game-card-elevated inline-block w-full max-w-xs px-6 pt-4 pb-5 mb-6"
          >
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.25em] font-display mb-3 text-left">
              Example
            </p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <PromptPair wordA="COW" wordB="SNOW" size="sm" />
              <span className="text-foreground/20 text-sm font-bold mx-1">→</span>
              <span className="text-primary text-xl font-black tracking-tight">Milk</span>
            </div>
            <p className="text-[10px] text-muted-foreground/50 font-display">
              Top crowd answer · 71% of players
            </p>
          </motion.div>

          {/* Primary CTA */}
          <Button
            size="lg"
            className="rounded-xl w-full max-w-xs h-[52px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[15px] active:scale-[0.97] transition-transform shadow-sm shadow-primary/20"
            asChild
          >
            <Link to={allDone ? '/results' : '/play'}>
              {allDone ? 'See my results' : someStarted ? 'Continue playing' : "Play today's prompts"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          {someStarted && !allDone && (
            <Button size="default" variant="ghost" className="w-full max-w-xs mt-2 text-muted-foreground text-sm" asChild>
              <Link to="/archive">View results</Link>
            </Button>
          )}
        </motion.div>
      </main>

      {/* How to play */}
      <section className="border-t border-border/60 py-8 px-5">
        <div className="max-w-md mx-auto">
          <h2 className="font-bold text-center mb-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
            How it works
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {[
              { num: '1', title: 'See two words', desc: 'A fresh pair appears each round.' },
              { num: '2', title: 'Enter one word', desc: 'What will most people say? Type that.' },
              { num: '3', title: 'Watch the crowd form', desc: 'See which answers cluster together.' },
              { num: '4', title: 'See your rank', desc: 'The strongest match is the one most people picked.' },
            ].map((s) => (
              <div key={s.num} className="text-center">
                <span className="font-display text-lg font-bold text-primary/30 leading-none">{s.num}</span>
                <h3 className="font-bold mt-1 mb-0.5 text-[13px] text-foreground tracking-tight">{s.title}</h3>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 space-y-3 px-5 pb-24 md:pb-6">
        <Countdown />
        <p className="text-center text-[9px] text-muted-foreground/30 tracking-widest uppercase font-display">
          JINX — daily crowd word game
        </p>
      </footer>
      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}