import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, UserPlus, LogOut, ArrowRight, Lock } from 'lucide-react';
import type { GroupWithActivity } from '@/lib/groups';

interface Props {
  group: GroupWithActivity;
  index: number;
  onInvite: (e: React.MouseEvent) => void;
  onLeave: () => void;
}

// Stable color hash from group id
function colorFor(id: string) {
  const palettes = [
    { bg: 'bg-primary/12', text: 'text-primary', border: 'border-primary/20' },
    { bg: 'bg-[hsl(var(--info))]/12', text: 'text-[hsl(var(--info))]', border: 'border-[hsl(var(--info))]/20' },
    { bg: 'bg-[hsl(var(--success))]/12', text: 'text-[hsl(var(--success))]', border: 'border-[hsl(var(--success))]/20' },
    { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-foreground/10' },
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}

export default function GroupFeedCard({ group, index, onInvite, onLeave }: Props) {
  const palette = colorFor(group.id);
  const initials = group.name.substring(0, 2).toUpperCase();
  const h = group.todayHeadline;
  const isUnreadJinx = !!h?.viewerPlayed === false && !!h?.answeredCount && h.answeredCount > 0;
  const isLive = group.hasActivityToday && !group.viewerPlayedToday;
  const isAllIn = h && h.answeredCount === h.totalMembers && h.totalMembers > 1;

  const statusPill = isAllIn
    ? { label: 'All in', cls: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' }
    : isLive
      ? { label: 'Live', cls: 'bg-primary/12 text-primary' }
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-card rounded-[14px] border border-foreground/[0.08] overflow-hidden group/card"
    >
      <Link
        to={`/g/${group.invite_code}/today`}
        className="block hover:bg-accent/20 transition-colors"
      >
        {/* Header strip */}
        <div className="flex items-center gap-[8px] px-[12px] pt-[10px] pb-[6px]">
          <div className={`w-[26px] h-[26px] rounded-full ${palette.bg} border ${palette.border} flex items-center justify-center shrink-0`}>
            <span className={`text-[10px] font-bold ${palette.text}`}>{initials}</span>
          </div>
          <p className="text-[12px] font-bold text-foreground truncate flex-1 leading-tight">{group.name}</p>
          {statusPill && (
            <span className={`text-[8px] px-[6px] py-[1px] rounded-full font-bold leading-none shrink-0 ${statusPill.cls}`}>
              {statusPill.label}
            </span>
          )}
        </div>

        {/* Hero block */}
        <div className="px-[12px] pb-[10px]">
          <HeadlineBlock group={group} />
        </div>
      </Link>

      {/* Footer chrome */}
      <div className="flex items-center px-[12px] py-[6px] border-t border-foreground/[0.04]">
        <span className="text-[10px] text-muted-foreground/50">
          {group.memberCount > 1 ? (
            <><span className="font-bold text-foreground/60">{group.todayAnsweredCount}/{group.memberCount}</span> today</>
          ) : (
            'Just you'
          )}
        </span>
        <div className="flex-1" />
        <button
          onClick={onInvite}
          className="p-[5px] rounded-md text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-colors"
          title="Invite"
        >
          <UserPlus className="h-3 w-3" />
        </button>
        <button
          onClick={onLeave}
          className="p-[5px] rounded-md text-muted-foreground/0 group-hover/card:text-muted-foreground/20 hover:!text-destructive/60 transition-colors ml-[2px]"
          title="Leave group"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Headline block: four states ── */
function HeadlineBlock({ group }: { group: GroupWithActivity }) {
  const h = group.todayHeadline;

  // State A: no prompts set up today
  if (!h || !h.word_a) {
    return (
      <div className="rounded-[10px] bg-muted/40 px-[10px] py-[12px] text-center">
        <p className="text-[11px] text-muted-foreground/60">Today's prompts aren't ready yet</p>
      </div>
    );
  }

  // State B: viewer hasn't played AND someone else has → blurred tease
  if (!h.viewerPlayed && h.answeredCount > 0) {
    return (
      <div className="relative rounded-[10px] bg-primary/[0.05] border border-primary/12 px-[10px] py-[12px] overflow-hidden">
        <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-primary/70 text-center mb-[6px]">
          {h.word_a} + {h.word_b}
        </p>
        <div className="relative flex items-center justify-center min-h-[36px]">
          {h.hasJinxToday ? (
            <span className="select-none blur-[6px] text-[22px] font-bold text-foreground tracking-tight">
              {h.jinxAnswer}
            </span>
          ) : (
            <div className="flex gap-[4px] blur-[5px]">
              {Array.from({ length: Math.min(h.answeredCount, 4) }).map((_, i) => (
                <span key={i} className="px-[10px] py-[3px] bg-muted/60 rounded-md text-[11px] font-bold">XXXX</span>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-center text-foreground/70 mt-[6px] font-semibold flex items-center justify-center gap-[4px]">
          <Lock className="h-2.5 w-2.5" />
          {h.answeredCount} {h.answeredCount === 1 ? 'person' : 'people'} answered · play to reveal
          <ArrowRight className="h-2.5 w-2.5" />
        </p>
      </div>
    );
  }

  // State C: viewer has played AND there's a jinx today
  if (h.viewerPlayed && h.hasJinxToday && h.jinxAnswer && h.jinxNames) {
    return (
      <div className="rounded-[10px] bg-primary/[0.06] border border-primary/15 px-[10px] py-[10px]">
        <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 text-center mb-[3px]">
          {h.word_a} + {h.word_b}
        </p>
        <div className="flex items-center justify-center gap-[5px] my-[2px]">
          <Zap className="h-3 w-3 text-primary fill-primary" />
          <span className="text-[20px] font-bold text-foreground tracking-tight leading-tight break-all text-center">
            {h.jinxAnswer}
          </span>
          <Zap className="h-3 w-3 text-primary fill-primary" />
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-[3px]">
          <span className="font-semibold text-foreground/80">{h.jinxNames[0]}</span> & <span className="font-semibold text-foreground/80">{h.jinxNames[1]}</span> both said it
        </p>
      </div>
    );
  }

  // State D: viewer played, no jinx today
  if (h.viewerPlayed) {
    return (
      <div className="rounded-[10px] bg-muted/40 px-[10px] py-[10px]">
        <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 text-center mb-[4px]">
          {h.word_a} + {h.word_b}
        </p>
        <p className="text-[12px] text-center text-foreground/70 font-semibold">
          {h.answeredCount > 1 ? 'No jinx today — everyone thought different' : 'Waiting on others'}
        </p>
      </div>
    );
  }

  // State E: nobody played yet (including viewer)
  return (
    <div className="rounded-[10px] bg-muted/40 px-[10px] py-[10px] text-center">
      <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 mb-[4px]">
        {h.word_a} + {h.word_b}
      </p>
      <p className="text-[11px] text-foreground/60">
        Nobody's played yet · <span className="text-primary font-semibold">be first</span>
      </p>
    </div>
  );
}
