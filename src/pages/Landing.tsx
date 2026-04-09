import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, Zap, Users } from 'lucide-react';
import PromptPair from '@/components/PromptPair';
import { Button } from '@/components/ui/button';
import { ensureDailyPrompts, syncCompletionStatus, type DbPrompt } from '@/lib/store';
import Countdown from '@/components/Countdown';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import MyRoomCard from '@/components/MyRoomCard';
import GroupsList from '@/components/GroupsList';
import { createChallenge, buildChallengeShareText } from '@/lib/challenge';
import { isRoomToday } from '@/lib/my-room';
import { useRoomHasNewActivity } from '@/hooks/use-room-activity';
import { getMyGroups, buildGroupInviteText, createGroup, type GroupWithActivity } from '@/lib/groups';
import { toast } from '@/hooks/use-toast';

export default function Landing() {
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [myGroups, setMyGroups] = useState<GroupWithActivity[]>([]);
  const navigate = useNavigate();
  const hasNewRoomActivity = useRoomHasNewActivity();

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
        navigate('/archive', { replace: true });
      }

      // Load groups
      const gs = await getMyGroups();
      setMyGroups(gs);
    })();
  }, [navigate]);

  const allDone = loaded && prompts.length > 0 && prompts.every(p => completedIds.has(p.id));
  const someStarted = loaded && prompts.some(p => completedIds.has(p.id));
  const showRoomCard = allDone && isRoomToday();
  const hasGroups = myGroups.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-xl mx-auto flex items-center justify-between h-14 px-5">
          <Link to="/">
            <JinxLogo size={22} className="text-foreground text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <PlayerIdentity />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm" asChild>
              <Link to="/groups">Groups</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm relative" asChild>
              <Link to="/archive">
                Archive
                {hasNewRoomActivity && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            </Button>
            {!allDone && (
              <Button size="sm" className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold px-4" asChild>
                <Link to="/play">Play</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex justify-center px-5 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-md"
        >
          <p className="text-[10px] font-display tracking-[0.3em] text-muted-foreground uppercase mb-3">Daily Crowd Word Game</p>
          <h1 className="text-6xl font-black tracking-tighter text-foreground mb-3 md:text-8xl">JINX</h1>
          <p className="text-[15px] text-primary font-semibold mb-2 py-[3px] my-0">Think the same. Rank higher.</p>
          <p className="text-[13px] text-muted-foreground mx-auto mb-6 leading-relaxed py-[3px]">
            See two words. Predict the bridge word most people will pick.
          </p>

          {allDone ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="game-card-elevated inline-block px-8 py-5 w-full max-w-xs">
              <CheckCircle2 className="h-5 w-5 text-primary mx-auto mb-1.5" />
              <p className="font-semibold text-[15px] mb-0.5 text-foreground">Today's JINX complete</p>
              <p className="text-[11px] text-muted-foreground mb-3">Results update live — check back for rank changes.</p>
              <div className="flex flex-col gap-2 w-full">
                <Button size="lg" className="rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm w-full active:scale-[0.97] transition-transform"
                  onClick={async () => {
                    try {
                      const ch = await createChallenge(prompts);
                      const text = buildChallengeShareText(prompts, ch.token);
                      if (navigator.share) {
                        try { await navigator.share({ text }); return; } catch {}
                      }
                      await navigator.clipboard.writeText(text);
                      toast({ title: 'Challenge copied!', description: 'Send it to a friend' });
                    } catch {
                      toast({ title: 'Could not create challenge', variant: 'destructive' });
                    }
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" /> Challenge a friend
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl h-11 font-semibold text-sm w-full" asChild>
                  <Link to="/archive"><Eye className="h-4 w-4 mr-2" /> View results</Link>
                </Button>
              </div>
              {showRoomCard && (
                <div className="mt-4 w-full text-left">
                  <MyRoomCard />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="game-card-elevated inline-block w-full max-w-sm px-7 pt-3.5 pb-4 rounded-xl"
            >
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em] font-display mb-2.5 text-left">Example prompt</p>
              <div className="flex items-center justify-center gap-3 mb-4">
                <PromptPair wordA="COW" wordB="SNOW" size="sm" />
                <span className="text-foreground/30 text-sm font-bold">→</span>
                <span className="text-primary text-lg font-display font-black tracking-tight">Milk</span>
              </div>
              <Button size="lg" className="rounded-lg w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[15px]" asChild>
                <Link to="/play">
                  {someStarted ? 'Continue playing' : 'Play today'} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {someStarted && (
                <Button size="default" variant="ghost" className="w-full mt-1.5 text-muted-foreground text-sm" asChild>
                  <Link to="/archive">View results</Link>
                </Button>
              )}
            </motion.div>
          )}

          {loaded && hasGroups && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 w-full max-w-xs mx-auto text-left"
            >
              <p className="text-[9px] uppercase tracking-[0.15em] font-display text-muted-foreground/40 mb-2 flex items-center justify-center gap-1.5"><Users className="h-2.5 w-2.5" /> Your groups</p>
              <GroupsList />
            </motion.div>
          )}
        </motion.div>
      </main>

      <section className="border-t border-border py-5 px-5">
        <div className="max-w-md mx-auto">
          <h2 className="font-bold text-center mb-4 text-base uppercase tracking-[0.15em] font-display text-foreground/80">How to play</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              { num: '1', title: 'See two words', desc: 'Find the bridge word most people will think of.' },
              { num: '2', title: 'Submit one answer', desc: 'Pick one word that feels most likely to match the crowd.' },
              { num: '3', title: 'Watch the patterns form', desc: 'See which answers cluster and which ones miss.' },
              { num: '4', title: 'Rank higher', desc: 'The closer you are to the crowd, the better you score.' },
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

      <footer className="border-t border-border py-5 space-y-2 px-5">
        <Countdown />
        <p className="text-center text-[10px] text-muted-foreground/40 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
