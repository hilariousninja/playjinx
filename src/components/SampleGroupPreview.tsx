import { useEffect, useState } from 'react';
import { Lock, Sparkles, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { getSampleHeadlineFromYesterday, type SampleHeadline } from '@/lib/groups';
import { toast } from '@/hooks/use-toast';

interface Props {
  groupName: string;
  inviteCode: string;
  inviteText: string;
}

/**
 * Empty / solo-group "magic" — preview what a populated group looks like
 * using yesterday's real top crowd answer, then a giant share CTA.
 *
 * Auto-dismisses (component unmounts) once a second member joins,
 * because at that point `memberCount > 1` and the parent renders the
 * real GroupTodayFeed instead.
 */
export default function SampleGroupPreview({ groupName, inviteCode, inviteText }: Props) {
  const [sample, setSample] = useState<SampleHeadline | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSampleHeadlineFromYesterday();
        if (!cancelled) setSample(s);
      } catch {
        if (!cancelled) setSample(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: inviteText }); return; } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(inviteText);
    toast({ title: 'Invite copied!', description: 'Paste it to anyone' });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-[12px]">
      {/* Label */}
      <div className="flex items-center justify-center gap-[5px]">
        <Sparkles className="h-3 w-3 text-primary/60" />
        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-foreground/60">
          Preview — what {groupName} looks like with friends
        </p>
      </div>

      {/* Sample hero */}
      <div className="rounded-[14px] border border-primary/20 bg-primary/[0.04] overflow-hidden">
        {sample === undefined ? (
          <div className="px-[14px] py-[28px] text-center">
            <div className="h-3 w-32 bg-muted/40 rounded mx-auto animate-pulse" />
          </div>
        ) : sample ? (
          <div className="px-[14px] py-[14px]">
            <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-foreground/60 text-center mb-[6px]">
              {sample.word_a} + {sample.word_b}
            </p>
            <p className="text-[24px] font-display font-bold text-foreground text-center leading-tight break-words mb-[6px]">
              {sample.jinxAnswer}
            </p>
            <p className="text-[11px] text-center text-muted-foreground">
              <span className="font-semibold text-foreground/80">{sample.jinxNames[0]}</span> & <span className="font-semibold text-foreground/80">{sample.jinxNames[1]}</span> both said it
            </p>
          </div>
        ) : (
          <div className="px-[14px] py-[18px] text-center">
            <p className="text-[11px] text-muted-foreground/60">
              Invite friends to see who thinks like you
            </p>
          </div>
        )}
        <div className="border-t border-primary/10 px-[10px] py-[6px] flex items-center justify-center gap-[4px] bg-background/40">
          <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.06em] font-semibold">
            Sample — invite to see real answers
          </span>
        </div>
      </div>

      {/* Giant share CTA */}
      <Button
        onClick={handleShare}
        className="w-full h-[52px] rounded-[14px] text-[14px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-transform shadow-sm"
      >
        <Share2 className="h-4 w-4 mr-2" />
        Invite a friend
      </Button>
      <p className="text-center text-[10px] text-muted-foreground/60">
        They play the same daily prompts · you see who matches
      </p>
    </motion.div>
  );
}
