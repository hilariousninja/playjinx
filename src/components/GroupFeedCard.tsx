import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, UserPlus, LogOut, ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { GroupWithActivity } from '@/lib/groups';
import {
  resolveGroupEmoji,
  resolveGroupAccent,
  getAccentTokens,
} from '@/lib/group-visuals';
import MemberAvatars from './MemberAvatars';

interface Props {
  group: GroupWithActivity;
  index: number;
  onInvite: (e: React.MouseEvent) => void;
  onLeave: () => void;
}

export default function GroupFeedCard({ group, index, onInvite, onLeave }: Props) {
  const emoji = resolveGroupEmoji(group);
  const accent = resolveGroupAccent(group);
  const tokens = getAccentTokens(accent);
  const h = group.todayHeadline;
  const isLive = group.hasActivityToday && !group.viewerPlayedToday;
  const isAllIn = h && h.answeredCount === h.totalMembers && h.totalMembers > 1;
  const isSolo = group.memberCount === 1;

  const statusPill = isAllIn
    ? { label: 'All in', cls: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' }
    : isLive
      ? { label: 'Live', cls: `${tokens.bgStrong} ${tokens.text}` }
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`bg-card rounded-[14px] border ${tokens.border} overflow-hidden group/card`}
    >
      <Link
        to={`/g/${group.invite_code}/today`}
        className="block hover:bg-accent/20 transition-colors"
      >
        {/* Header strip */}
        <div className="flex items-center gap-[8px] px-[12px] pt-[10px] pb-[6px]">
          <div className={`w-[28px] h-[28px] rounded-[8px] ${tokens.bgStrong} border ${tokens.border} flex items-center justify-center shrink-0`}>
            <span className="text-[15px] leading-none">{emoji}</span>
          </div>
          <p className="text-[12px] font-bold text-foreground truncate flex-1 leading-tight">{group.name}</p>
          {group.newSinceLastVisit > 0 && !isSolo && (
            <span className="text-[8px] px-[6px] py-[1px] rounded-full font-bold leading-none shrink-0 bg-primary text-primary-foreground">
              {group.newSinceLastVisit > 9 ? '9+' : group.newSinceLastVisit} new
            </span>
          )}
          {statusPill && group.newSinceLastVisit === 0 && (
            <span className={`text-[8px] px-[6px] py-[1px] rounded-full font-bold leading-none shrink-0 ${statusPill.cls}`}>
              {statusPill.label}
            </span>
          )}
        </div>

        {/* Hero block */}
        <div className="px-[12px] pb-[10px]">
          {isSolo ? <SoloHero /> : <HeadlineBlock group={group} />}
        </div>
      </Link>

      {/* Footer chrome */}
      <div className="flex items-center px-[12px] py-[7px] border-t border-foreground/[0.04] gap-[8px]">
        {group.memberPreview.length > 0 && (
          <MemberAvatars members={group.memberPreview} max={4} size={20} />
        )}
        <span className="text-[10px] text-muted-foreground/60">
          {isSolo ? (
            'Just you'
          ) : (
            <><span className="font-bold text-foreground/70">{group.todayAnsweredCount}/{group.memberCount}</span> today</>
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

/* ── Solo group hero — invites action ── */
function SoloHero() {
  return (
    <div className="rounded-[10px] bg-muted/40 px-[10px] py-[12px] text-center space-y-[3px]">
      <Sparkles className="h-3.5 w-3.5 text-primary/60 mx-auto" />
      <p className="text-[11px] font-semibold text-foreground/80">Invite a friend to start jinxing</p>
      <p className="text-[10px] text-muted-foreground/60">Tap to invite — same prompts, same day</p>
    </div>
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
  if (h.viewerPlayed && h.hasJinxToday && h.jinxAnswer && h.jinxNames && h.jinxNames.length >= 2) {
    const names = h.jinxNames;
    const namesLabel =
      names.length === 2
        ? <><span className="font-semibold text-foreground/80">{names[0]}</span> & <span className="font-semibold text-foreground/80">{names[1]}</span> both said it</>
        : <>
            {names.slice(0, -1).map((n, i) => (
              <span key={i}>
                <span className="font-semibold text-foreground/80">{n}</span>{i < names.length - 2 ? ', ' : ''}
              </span>
            ))}
            {' & '}
            <span className="font-semibold text-foreground/80">{names[names.length - 1]}</span>
            {' all said it'}
          </>;
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
          {namesLabel}
        </p>
      </div>
    );
  }

  // State D: viewer played, no jinx today
  if (h.viewerPlayed) {
    // For small groups (≤3) show each member's actual answer side-by-side
    if (h.allAnswers && h.allAnswers.length >= 2) {
      return (
        <div className="rounded-[10px] bg-muted/40 px-[10px] py-[10px]">
          <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 text-center mb-[6px]">
            {h.word_a} + {h.word_b}
          </p>
          <div className="space-y-[4px]">
            {h.allAnswers.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-[8px] px-[8px] py-[4px] rounded-[6px] bg-background/60">
                <span className={`text-[10px] font-bold uppercase tracking-[0.08em] shrink-0 ${a.isViewer ? 'text-primary' : 'text-foreground/60'}`}>
                  {a.isViewer ? 'You' : a.name}
                </span>
                <span className="text-[13px] font-semibold text-foreground text-right truncate">
                  {a.answer}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-center text-muted-foreground/70 mt-[6px]">
            No jinx — everyone thought different
          </p>
        </div>
      );
    }
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
