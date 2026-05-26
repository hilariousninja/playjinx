import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { getTopPairsForViewer, type ViewerPair } from '@/lib/groups';
import { memberColor, memberInitials } from '@/lib/group-visuals';

interface Props {
  groupId: string;
  inviteCode: string;
  /** Total members in the group; row is hidden if < 3 (only viewer + 1 other → Pair page handled elsewhere). */
  memberCount: number;
}

/**
 * Horizontally-scrolling "Your pairs" row.
 * Surfaces the viewer's top jinx-mates so the Pair page is discoverable from
 * inside Today and History.
 */
export default function PairChipsRow({ groupId, inviteCode, memberCount }: Props) {
  const [pairs, setPairs] = useState<ViewerPair[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getTopPairsForViewer(groupId, 5);
        if (!cancelled) setPairs(p);
      } catch {
        if (!cancelled) setPairs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  if (memberCount < 3) return null; // only one possible pair — no point in chips
  if (!pairs || pairs.length === 0) return null;

  return (
    <div className="pt-[2px]">
      <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px]">
        Your pairs
      </p>
      <div className="flex gap-[6px] overflow-x-auto pb-[2px] -mx-1 px-1 scrollbar-none">
        {pairs.map(p => (
          <Link
            key={p.otherSessionId}
            to={`/g/${inviteCode}/pair/${p.otherSessionId}`}
            className="shrink-0 flex items-center gap-[7px] pl-[6px] pr-[9px] py-[5px] rounded-full bg-card border border-foreground/[0.08] hover:border-primary/30 hover:bg-primary/[0.03] transition-colors"
          >
            <div
              className={`w-[20px] h-[20px] rounded-full flex items-center justify-center text-[8px] font-bold leading-none ${memberColor(p.otherSessionId)}`}
            >
              {memberInitials(p.otherDisplayName)}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[80px]">{p.otherDisplayName}</span>
              <span className="text-[9px] text-primary font-semibold flex items-center gap-[2px]">
                <Zap className="h-2 w-2 fill-current" /> {p.jinxCount} JINX{p.jinxCount !== 1 ? 'es' : ''}
              </span>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
