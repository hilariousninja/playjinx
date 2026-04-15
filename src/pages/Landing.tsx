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
          <h1 className="text-[46px] font-bold tracking-[-0.03em] text-foreground leading-none mb-[8px]">
            JINX
          </h1>
          <p className="text-[15px] font-medium text-primary mb-[18px]">
            Think the same. Rank higher.
          </p>

          {/* Example card — teaches the mechanic visually */}
          <div className="bg-card rounded-[14px] border border-foreground/[0.08] p-[14px] mb-[18px]">
            <div className="flex items-center justify-center gap-[8px] mb-[8px]">
              <span className="text-[16px] font-semibold tracking-[0.04em] text-foreground">COW</span>
              <span className="text-[12px] text-foreground/20">+</span>
              <span className="text-[16px] font-semibold tracking-[0.04em] text-foreground">SNOW</span>
              <span className="text-[13px] text-foreground/25 mx-[2px]">→</span>
              <span className="text-[16px] font-semibold text-primary bg-primary/10 px-[10px] py-[3px] rounded-[6px] border border-primary/15">
                Milk
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Two words. One answer. Match the crowd.
            </p>
          </div>

          {/* CTA */}
          <Link
            to={allDone ? '/results' : '/play'}
            className="block w-full py-[13px] bg-primary text-white rounded-[12px] text-[14px] font-semibold text-center mb-[14px] active:scale-[0.97] transition-transform"
          >
            {allDone ? 'See my results →' : someStarted ? 'Continue playing →' : "Play today's 3 prompts →"}
          </Link>

          <Countdown />
        </motion.div>
      </main>

      <MobileBottomNav hasNewRoomActivity={hasNewRoomActivity} hasGroupActivity={hasGroupActivity} />
    </div>
  );
}
