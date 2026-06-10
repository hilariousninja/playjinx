# Fix: cook/cooking should JINX in Groups view (matches Archive)

## The bug

Archive groups answers by **stem + fuzzy merge** (`cook`, `cooking` → one cluster), so you and Steph register as a JINX there.

The Groups view (`/groups`, `/g/:inviteCode` Today, GroupFeedCard) buckets answers by **raw `normalized_answer` only**. `cook` and `cooking` stay in separate buckets → "No jinx — everyone thought different".

## Fix

Apply the same stem-based clustering inside `src/lib/groups.ts` everywhere we currently bucket by `normalized_answer`. One shared helper, used in every group code path so Today / GroupFeedCard / GroupTodayFeed / History / pairwise jinx counts all agree with Archive.

### New helper

In `src/lib/groups.ts` (top-level, not exported unless needed):

```ts
import { stemAnswer } from '@/lib/normalize';

// Returns the cluster key for a normalized answer. Multi-word answers
// keep their full normalized form (we only stem single tokens, matching
// ResultsView/archive behavior).
function clusterKey(normalized: string): string {
  if (!normalized) return normalized;
  if (normalized.includes(' ')) return normalized;
  return stemAnswer(normalized);
}
```

The cluster's **display label** stays the most-submitted raw answer in that cluster (so the card still shows "cook" if 2 said cook and 1 said cooking, "cooking" if reversed) — same rule Archive uses.

### Touch points in `src/lib/groups.ts`

Each of these currently keys a Map by `a.normalized_answer`. Switch the key to `clusterKey(a.normalized_answer)` and pick the display label by highest-count raw within the cluster:

1. `getGroupsList` (~line 331) — `clusters` map used to detect the "winning" JINX cluster on the Groups list card (the `Bed` / `Cook` headline).
2. `getGroupDayResults` (~line 458) — `clusterMap` powering `GroupTodayFeed` (the screen showing PIZZA + STORM with hot/cook/cooking rows).
3. `getGroupHistory` path (~line 751) — historical day cards' `clusterMap`.
4. Pairwise jinx aggregation (~line 1037–1045 `mineByNorm` / `theirsByNorm`) — so the "X & Y both said it" count uses stems.
5. Per-prompt pairwise comparison (~line 1156) — `mine` vs `others` equality check becomes `clusterKey(mine) === clusterKey(other)`.

Within each cluster, compute the display label as: pick the raw_answer whose normalized form has the highest submission count in the cluster; ties → the lexicographically shortest one (deterministic, matches Archive's preference for the shorter root form).

### What changes visually

Today, with the live data:
- `/groups` Indo-Chinese Fusion card → headline goes from "No jinx — everyone thought different" to **"⚡ Cook · You & Steph both said it"**.
- `/g/.../today` PIZZA + STORM → goes from 3 separate rows (hot/cook/cooking) to **2 clusters**: `cook` with Steph + Raj(you) (JINX), and `hot` with Ellie. "3 unique" becomes "2 unique · 1 jinx".
- History pairwise jinx counts back-fill correctly because they re-aggregate on read.

### Out of scope
- No DB migration. Stored `normalized_answer` is untouched; clustering is purely a read-time grouping (same as Archive).
- No change to Play / submission flow.
- No change to challenge-room (`RoomResults` / `challenge-room.ts`) — separate request if you want me to apply the same fix there.

### Verification
- Manual: refresh `/groups` and `/g/w4-...` Today; PIZZA + STORM should show a JINX cluster with you + Steph.
- Unit: add a `groups-cluster.test.ts` covering cook/cooking/cooked merging into one cluster and "bake"/"bike" staying separate (the stemmer already guards short-word false merges).
