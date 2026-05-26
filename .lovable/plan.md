# Members tab on group screen

## Problem

The `PairChipsRow` on Today/History scrolls horizontally. With 5+ members you can't see everyone at a glance, and the chip row competes with the result feed for vertical space. There's no single place to see "who is in this group and how do I jinx with each of them."

## Proposal

Add a third tab next to **Today / History** called **Members**, giving a full, scannable grid of every pair (you ↔ each other member). Slim down (or remove) the chips row on Today.

## Tabs after change

```text
[ Today ]  [ Members ]  [ History ]
```

`Today` first (default), `Members` middle for discoverability, `History` last (lower-frequency).

## Members tab contents

A vertical list (full-width rows, no horizontal scroll), one row per other member, sorted by jinx count desc then name:

```text
┌──────────────────────────────────────────────┐
│ (AN)  Andy                  ⚡ 19 JINXes  ›  │
│       Twin · last jinx today                 │
├──────────────────────────────────────────────┤
│ (EL)  Ellie                 ⚡ 2 JINXes   ›  │
│       Wildcard · last jinx 3d ago            │
├──────────────────────────────────────────────┤
│ (JO)  Jourdain              ⚡ 0 JINXes   ›  │
│       No jinxes yet                          │
└──────────────────────────────────────────────┘
```

Each row links to `/g/:inviteCode/pair/:sessionId` (same target as today's chips). Uses existing `memberColor` / `memberInitials` + `ViewerPair` data, just listed vertically and including zero-jinx members so the full roster is visible.

Empty state (group of 1): "Invite someone to start jinxing" + Invite button.

## Chips row changes (Today / History)

Two options to pick from after plan approval; my recommendation is **A**:

- **A. Remove `PairChipsRow` entirely.** Members tab replaces it. Cleaner Today, no duplicated affordance.
- **B. Keep chips row but cap at top 3 + show a "See all N →" chip that switches to the Members tab.** Preserves quick-access for the most-jinxed pair without the scroll problem.

## Bottom-nav badge

Unchanged. "New since last visit" still derived from group activity, not from which tab is open.

## Technical notes

- File: `src/pages/GroupToday.tsx` — extend `Tab` type to `'today' | 'members' | 'history'`, render new section.
- New component: `src/components/GroupMembersList.tsx` — takes `groupId`, `inviteCode`, reuses `getTopPairsForViewer` but called with no limit (or a new `getAllPairsForViewer`) so zero-jinx members appear too.
- `src/lib/groups.ts` — add `getAllPairsForViewer(groupId)` that joins members ∪ pair stats, so members with 0 jinxes still get a row.
- Remove or trim `PairChipsRow` usages depending on chosen option.

## Out of scope

- Per-pair stats beyond jinx count + last-jinx date (e.g. rivalry meter) — stays on the Pair page.
- Reordering Today/History defaults beyond tab insertion.
