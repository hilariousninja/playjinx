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

      <main className="flex justify-center px-5 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-md"
        >
          <p className="text-[10px] font-display tracking-[0.3em] text-muted-foreground uppercase mb-3">
            Daily Crowd Word Game
          </p>
          <h1 className="text-6xl font-black tracking-tighter text-foreground mb-3 md:text-8xl">
            JINX
          </h1>
          <p className="text-[15px] text-primary font-semibold mb-1">
            Think the same. Rank higher.
          </p>
          <p className="text-[13px] text-muted-foreground mx-auto mb-4 leading-relaxed max-w-xs">
            Three word pairs each day. Find the bridge word the crowd will pick.
          </p>

          {/* Amber callout */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 mb-5 max-w-sm mx-auto">
            <p className="text-[12px] text-primary font-semibold">
              Not the cleverest answer. The most common one.
            </p>
          </div>

          {/* Example card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="game-card-elevated inline-block w-full max-w-sm px-7 pt-3.5 pb-4 rounded-xl mb-5"
          >
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em] font-display mb-2.5 text-left">
              Example prompt
            </p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <PromptPair wordA="COW" wordB="SNOW" size="sm" />
              <span className="text-foreground/30 text-sm font-bold">→</span>
              <span className="text-primary text-lg font-display font-black tracking-tight">Milk</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Top crowd answer · 71% of players
            </p>
          </motion.div>

          {/* Primary CTA */}
          <Button
            size="lg"
            className="rounded-xl w-full max-w-sm h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[15px] active:scale-[0.97] transition-transform"
            asChild
          >
            <Link to={allDone ? '/results' : '/play'}>
              {allDone ? 'See my results' : someStarted ? 'Continue playing' : "Play today's 3 prompts"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          {someStarted && !allDone && (
            <Button size="default" variant="ghost" className="w-full max-w-sm mt-1.5 text-muted-foreground text-sm" asChild>
              <Link to="/archive">View results</Link>
            </Button>
          )}
        </motion.div>
      </main>

      {/* How to play */}
      <section className="border-t border-border py-5 px-5">
        <div className="max-w-md mx-auto">
          <h2 className="font-bold text-center mb-4 text-base uppercase tracking-[0.15em] font-display text-foreground/80">
            How it works
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              { num: '1', title: 'See two words', desc: 'Find the bridge word that connects them.' },
              { num: '2', title: 'Submit one answer', desc: 'Pick the word you think most people will say.' },
              { num: '3', title: 'Watch the crowd form', desc: 'See which answers cluster together.' },
              { num: '4', title: 'See how close you were', desc: 'The strongest match is the one the crowd picks most.' },
            ].map((s) => (
              <div key={s.num} className="text-center">
                <span className="font-display text-lg font-bold text-primary/40">{s.num}</span>
                <h3 className="font-bold mt-0.5 mb-0.5 text-sm text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-5 space-y-2 px-5 pb-20 md:pb-5">
        <Countdown />
        <p className="text-center text-[10px] text-muted-foreground/40 tracking-wide">JINX — daily crowd word game</p>
      </footer>
      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
