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

      <main className="flex-1 flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-lg py-10"
        >
          <p className="text-[10px] font-display tracking-[0.3em] text-muted-foreground uppercase mb-2">Daily Crowd Word Game</p>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground mb-2">JINX</h1>

          <p className="text-sm text-primary max-w-sm mx-auto font-semibold leading-relaxed">Think the same. Rank higher.</p>

          <p className="text-[13px] text-muted-foreground max-w-[18rem] mx-auto mt-1.5 mb-5 leading-relaxed">
            See two words. Predict the bridge word most people will pick.
          </p>

          {allDone ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="game-card-elevated inline-block px-10 py-6 mb-4 w-full max-w-sm">
              <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="font-semibold text-[15px] mb-0.5 text-foreground">Today's JINX complete</p>
              <p className="text-[11px] text-muted-foreground mb-4">Results update live — check back for rank changes.</p>
              <div className="flex flex-col gap-2 w-full max-w-[18rem] mx-auto">
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
                <div className="mt-5 w-full max-w-[18rem] mx-auto text-left">
                  <MyRoomCard />
                </div>
              )}
            </motion.div>
          ) : (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="game-card-elevated inline-block w-full max-w-sm px-8 py-4 mb-4">
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.2em] font-display mb-2">Example prompt</p>
                <PromptPair wordA="COW" wordB="SNOW" size="md" className="mb-2" />
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground/50 text-sm">→</span>
                  <span className="text-primary text-lg font-display font-bold tracking-tight">Milk</span>
                </div>
              </motion.div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" className="rounded-lg px-10 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[15px]" asChild>
                  <Link to="/play">
                    {someStarted ? 'Continue playing' : 'Play today'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {someStarted && (
                  <Button size="lg" variant="outline" className="rounded-lg px-6 h-12" asChild>
                    <Link to="/archive">View results</Link>
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Your groups — for returning users */}
          {loaded && hasGroups && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 w-full max-w-xs mx-auto text-left"
            >
              <p className="text-[9px] uppercase tracking-[0.15em] font-display text-muted-foreground/40 mb-2 flex items-center justify-center gap-1.5"><Users className="h-2.5 w-2.5" /> Your groups</p>
              <GroupsList />
            </motion.div>
          )}
        </motion.div>
      </main>

      <section className="border-t border-border py-10 px-5">
        <div className="max-w-md mx-auto">
          <h2 className="text-sm font-bold text-center mb-6 tracking-tight text-foreground">How it works</h2>
          <div className="grid grid-cols-2 gap-5">
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

      <footer className="border-t border-border py-4 space-y-1.5 px-5">
        <Countdown />
        <p className="text-center text-[10px] text-muted-foreground/40 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
