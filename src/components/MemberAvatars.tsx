import { memberColor, memberInitials } from '@/lib/group-visuals';

interface Props {
  members: { session_id: string; display_name: string }[];
  max?: number;
  size?: number; // px
}

/** Overlapping stacked initials avatars with +N overflow. */
export default function MemberAvatars({ members, max = 4, size = 22 }: Props) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  const overlap = Math.round(size * 0.32);

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.session_id}
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: shown.length - i,
          }}
          className={`rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold leading-none ${memberColor(m.session_id)}`}
          title={m.display_name}
        >
          {memberInitials(m.display_name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: size,
            height: size,
            marginLeft: -overlap,
          }}
          className="rounded-full border-2 border-background bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold leading-none"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
