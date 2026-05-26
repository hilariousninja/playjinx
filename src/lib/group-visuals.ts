/**
 * Single source of truth for group emoji/accent defaults and per-session member colours.
 * Used by GroupFeedCard, GroupToday, GroupPair so identity stays consistent.
 */

export const GROUP_EMOJI_PRESETS = ['🎯', '🎲', '🔥', '⚡', '🌶️', '🍿', '🪩', '🧠'] as const;

export type GroupAccent = 'amber' | 'rose' | 'violet' | 'teal' | 'sky' | 'lime';

export const GROUP_ACCENT_PRESETS: GroupAccent[] = ['amber', 'rose', 'violet', 'teal', 'sky', 'lime'];

interface AccentTokens {
  bg: string;       // soft tint background
  bgStrong: string; // slightly stronger tint
  border: string;   // subtle border
  text: string;     // text colour
  ring: string;     // border-2 / focus ring
}

const ACCENT_TOKENS: Record<GroupAccent, AccentTokens> = {
  amber: {
    bg: 'bg-[hsl(38,92%,50%)]/10',
    bgStrong: 'bg-[hsl(38,92%,50%)]/20',
    border: 'border-[hsl(38,92%,50%)]/25',
    text: 'text-[hsl(38,92%,40%)]',
    ring: 'border-[hsl(38,92%,50%)]/30',
  },
  rose: {
    bg: 'bg-[hsl(346,80%,55%)]/10',
    bgStrong: 'bg-[hsl(346,80%,55%)]/20',
    border: 'border-[hsl(346,80%,55%)]/25',
    text: 'text-[hsl(346,80%,45%)]',
    ring: 'border-[hsl(346,80%,55%)]/30',
  },
  violet: {
    bg: 'bg-[hsl(262,70%,60%)]/10',
    bgStrong: 'bg-[hsl(262,70%,60%)]/20',
    border: 'border-[hsl(262,70%,60%)]/25',
    text: 'text-[hsl(262,70%,50%)]',
    ring: 'border-[hsl(262,70%,60%)]/30',
  },
  teal: {
    bg: 'bg-[hsl(174,60%,42%)]/10',
    bgStrong: 'bg-[hsl(174,60%,42%)]/20',
    border: 'border-[hsl(174,60%,42%)]/25',
    text: 'text-[hsl(174,60%,32%)]',
    ring: 'border-[hsl(174,60%,42%)]/30',
  },
  sky: {
    bg: 'bg-[hsl(205,80%,55%)]/10',
    bgStrong: 'bg-[hsl(205,80%,55%)]/20',
    border: 'border-[hsl(205,80%,55%)]/25',
    text: 'text-[hsl(205,80%,42%)]',
    ring: 'border-[hsl(205,80%,55%)]/30',
  },
  lime: {
    bg: 'bg-[hsl(86,60%,42%)]/10',
    bgStrong: 'bg-[hsl(86,60%,42%)]/20',
    border: 'border-[hsl(86,60%,42%)]/25',
    text: 'text-[hsl(86,60%,30%)]',
    ring: 'border-[hsl(86,60%,42%)]/30',
  },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function resolveGroupEmoji(group: { emoji?: string | null; id: string }): string {
  if (group.emoji && group.emoji.trim()) return group.emoji;
  return GROUP_EMOJI_PRESETS[hashString(group.id) % GROUP_EMOJI_PRESETS.length];
}

export function resolveGroupAccent(group: { accent?: string | null; id: string }): GroupAccent {
  if (group.accent && (GROUP_ACCENT_PRESETS as string[]).includes(group.accent)) {
    return group.accent as GroupAccent;
  }
  return GROUP_ACCENT_PRESETS[hashString(group.id) % GROUP_ACCENT_PRESETS.length];
}

export function getAccentTokens(accent: GroupAccent): AccentTokens {
  return ACCENT_TOKENS[accent];
}

/** Per-member colour from session id — used for stacked avatars. */
const MEMBER_PALETTE = [
  'bg-[hsl(38,92%,55%)] text-white',
  'bg-[hsl(346,75%,55%)] text-white',
  'bg-[hsl(262,65%,60%)] text-white',
  'bg-[hsl(174,55%,42%)] text-white',
  'bg-[hsl(205,75%,55%)] text-white',
  'bg-[hsl(86,55%,42%)] text-white',
  'bg-[hsl(15,80%,55%)] text-white',
  'bg-[hsl(290,55%,55%)] text-white',
];

export function memberColor(sessionId: string): string {
  return MEMBER_PALETTE[hashString(sessionId) % MEMBER_PALETTE.length];
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
