import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Zap, ChevronRight, Loader2, Share2 } from 'lucide-react';
import { getAllPairsForViewer, type ViewerPair } from '@/lib/groups';
import { memberColor, memberInitials } from '@/lib/group-visuals';
import { Button } from '@/components/ui/button';

interface Props {
  groupId: string;
  inviteCode: string;
  memberCount: number;
  onInvite: () => void;
}

function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(iso + 'T00:00:00');
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function rivalryLabel(p: ViewerPair): string | null {
  if (p.daysTogether < 2) return null;
  const rate = p.jinxCount / p.daysTogether;
  if (rate >= 0.6) return 'Twin';
  if (rate >= 0.3) return 'Sync';
  if (rate >= 0.1) return 'Wildcard';
  return 'Opposite';
}

export default function GroupMembersList({ groupId, inviteCode, memberCount, onInvite }: Props) {
  const [pairs, setPairs] = useState<ViewerPair[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getAllPairsForViewer(groupId);
        if (!cancelled) setPairs(p);
      } catch {
        if (!cancelled) setPairs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  if (!pairs) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (memberCount <= 1 || pairs.length === 0) {
    return (
      <div className="rounded-[12px] border border-border/50 bg-card p-[16px] text-center space-y-[10px]">
        <p className="text-[12px] text-muted-foreground">
          You're the only one here. Invite someone to start jinxing.
        </p>
        <Button
          size="sm"
          className="rounded-[8px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[11px]"
          onClick={onInvite}
        >
          <Share2 className="mr-1.5 h-3 w-3" /> Invite
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border/50 bg-card overflow-hidden divide-y divide-border/40">
      {pairs.map(p => {
        const lastJinx = relativeDay(p.lastJinxDate);
        const rivalry = rivalryLabel(p);
        const subtitleParts: string[] = [];
        if (rivalry) subtitleParts.push(rivalry);
        if (lastJinx) subtitleParts.push(`last jinx ${lastJinx}`);
        else if (p.daysTogether > 0) subtitleParts.push('no jinxes yet');
        else subtitleParts.push('not played together');

        return (
          <Link
            key={p.otherSessionId}
            to={`/g/${inviteCode}/pair/${p.otherSessionId}`}
            className="flex items-center gap-[11px] px-[12px] py-[10px] hover:bg-muted/30 active:bg-muted/50 transition-colors"
          >
            <div
              className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold leading-none shrink-0 ${memberColor(p.otherSessionId)}`}
            >
              {memberInitials(p.otherDisplayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate leading-tight">
                {p.otherDisplayName}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-[2px] truncate">
                {subtitleParts.join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-[3px] shrink-0">
              <Zap className={`h-[11px] w-[11px] ${p.jinxCount > 0 ? 'text-primary fill-current' : 'text-muted-foreground/30'}`} />
              <span className={`text-[11px] font-bold ${p.jinxCount > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
                {p.jinxCount}
              </span>
              <span className={`text-[9px] uppercase tracking-wide ml-[2px] ${p.jinxCount > 0 ? 'text-primary/80' : 'text-muted-foreground/40'}`}>
                JINX{p.jinxCount !== 1 ? 'es' : ''}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
