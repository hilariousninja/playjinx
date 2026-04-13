import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <AppHeader hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />

      <main className="flex-1 overflow-y-auto flex justify-center px-4 pt-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center w-full max-w-md"
        >
          <p className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase mb-[10px]">
            Daily Crowd Word Game
          </p>
          <h1 className="text-[46px] font-bold tracking-[-0.03em] text-foreground leading-none mb-[10px]">
            JINX
          </h1>
          <p className="text-[15px] font-medium text-primary mb-[5px]">
            Think the same. Rank higher.
          </p>
          <p className="text-[12px] text-muted-foreground leading-[1.5] mb-[5px]">
            Three word pairs each day. Enter the word you think most people will say.
          </p>

          {/* Amber callout */}
          <div className="bg-primary/12 rounded-lg px-[14px] py-[6px] mb-4 inline-block">
            <p className="text-[12px] font-semibold text-[hsl(var(--warning-foreground))]">
              Not the cleverest answer. The most common one.
            </p>
          </div>

          {/* Example card */}
          <div className="bg-card rounded-[14px] border border-foreground/[0.08] p-[13px] mb-4 text-left">
            <p className="text-[10px] tracking-[0.06em] text-muted-foreground uppercase mb-[7px]">
              Example
            </p>
            <div className="flex items-center justify-center gap-[6px] mb-1">
              <span className="text-[16px] font-semibold tracking-[0.04em] text-foreground">COW</span>
              <span className="text-[13px] text-muted-foreground">+</span>
              <span className="text-[16px] font-semibold tracking-[0.04em] text-foreground">SNOW</span>
              <span className="text-[13px] text-muted-foreground">→</span>
              <span className="text-[16px] font-semibold text-primary bg-primary/12 px-[10px] py-[3px] rounded-[6px]">Milk</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Top crowd answer · <span className="font-semibold text-primary">71% of players</span>
            </p>
          </div>

          {/* CTA */}
          <Link
            to={allDone ? '/results' : '/play'}
            className="block w-full py-[13px] bg-primary text-white rounded-[12px] text-[14px] font-semibold text-center mb-[18px] active:scale-[0.97] transition-transform"
          >
            {allDone ? 'See my results →' : someStarted ? 'Continue playing →' : "Play today's 3 prompts →"}
          </Link>

          {/* How it works */}
          <p className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase text-center mb-[9px]">
            How it works
          </p>
          <div className="grid grid-cols-2 gap-[6px] mb-[14px]">
            {[
              { num: '1', title: 'See two words', desc: 'What word will most people say?' },
              { num: '2', title: 'Answer all three', desc: 'Match the crowd, not the cleverest.' },
              { num: '3', title: 'See the full spread', desc: 'All answers ranked. Including the wild ones.' },
              { num: '4', title: 'Share your score', desc: 'One clear result. Easy to brag about.' },
            ].map(s => (
              <div key={s.num} className="bg-card rounded-[11px] border border-foreground/[0.08] p-[10px] text-left">
                <p className="text-[11px] font-semibold text-primary mb-[3px]">{s.num}</p>
                <p className="text-[11px] font-semibold text-foreground mb-[2px] leading-[1.3]">{s.title}</p>
                <p className="text-[10px] text-muted-foreground leading-[1.4]">{s.desc}</p>
              </div>
            ))}
          </div>

          <Countdown />
        </motion.div>
      </main>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
