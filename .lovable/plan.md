## Make Groups view show variation labels within a jinx cluster

Right now the Groups view collapses `cook` + `cooking` to a single label (e.g. `Cook`) once we apply stem clustering. The Archive keeps each player's own raw answer visible — so it's clear *both* that you said different words *and* that they jinxed. The Groups view should do the same.

### What the user should see

For a jinxed cluster like Steph "cook" + You "cooking":

- **JINX hero (GroupTodayFeed `JinxHero`)**:
  - Replace the single big label with per-member rows showing each member's own raw_answer next to their chip.
  - Example layout (kept compact, still inside the amber jinx tile):
    ```text
    ⚡ YOU JINXED
    Steph    cook
    You      cooking
    ```
  - If all members happen to share the exact same raw form, fall back to today's single hero label (no change).

- **Groups list card headline (`getGroupsList`)**: keep the single cluster label (it's a one-line headline — too small for variations). No change.

- **UniqueTile non-jinx rows**: already shows each member's own answer — no change.

- **History day cards (`getGroupHistory` + `GroupHistory.tsx`)**: same treatment as JinxHero — when a pairwise jinx label is displayed and the two members' raws differ, show "Steph cook · You cooking" rather than a single label. Same fallback when raws match.

- **GroupFeedCard winning-cluster headline**: this is a single-line celebratory card — keep the single `pickClusterLabel` label. No change.

### Data changes in `src/lib/groups.ts`

Extend the cluster shape used in `GroupDayResult.clusters` and `GroupDayPromptDetail.clusters`:

```ts
clusters: {
  answer: string;                  // existing display label (most-popular raw)
  members: string[];               // existing display names
  variants: { name: string; raw: string }[]; // NEW: per-member raw answer for variation display
}[]
```

Populate `variants` inside `getGroupDayResults` (~line 489) and `getGroupHistory` (~line 779) at the same time we build `clusterMap` — we already have `raw_answer` + `display_name` per answer. `variants` preserves the order matching `members` and is built straight from `promptAnswers`.

Pairwise jinx headlines (`getGroupHistory`, `getPairData`, `getPairEnrichment`) likewise return both members' raw forms when they differ, so the day card can render "Steph cook · You cooking" instead of one collapsed label. Where the API currently returns `{ answer }`, change to `{ answer, rawA, rawB }` (or equivalent) and let the consumer decide to display them inline when they differ.

### UI changes

- **`src/components/GroupTodayFeed.tsx` `JinxHero`**: detect whether all `variants[].raw` (normalized lowercase) are identical.
  - If identical → keep current single big label.
  - If varied → render a compact stacked list: each row = `MemberChip` + member's own raw (display-cased) in the same big display font, right-aligned or inline. Reuse existing chip styling.

- **`src/components/GroupHistory.tsx`** (and any pairwise jinx render): when `rawA !== rawB`, render the two raws joined by a thin divider; otherwise render the single shared label.

### Out of scope

- No DB changes.
- No change to challenge-room (`RoomResults`).
- No change to Archive (`ResultsView`) — it already handles this.
- Groups list card and GroupFeedCard headlines keep their single-label format.

### Verification

- Manual: with current live data (Steph cook, You cooking) on `/g/.../today` — JINX strip should show both words stacked with chips.
- Add `groups-cluster.test.ts` cases: cluster of `{cook, cooking}` exposes `variants` with both raws and `members.length === 2`; cluster of `{cook, cook}` exposes identical variants so UI uses single-label fallback.
