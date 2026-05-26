
# Groups overhaul — revised roadmap

Reordered and trimmed based on honest analysis: lead with the surfaces every new user touches (front door + first reveal), defer anything that depends on data density we don't yet have, and drop the items whose downside risk outweighs the upside.

Design system stays locked: amber primary, cream bg, Space Grotesk, mobile-first 360–390px, semantic tokens only, no new deps.

---

## Ship order

```text
1. Today result-led          ← biggest single win
2. Solo / empty magic        ← fixes the front door
3. Group personality         ← cheap identity polish
4. Pair v2 + discoverability ← flagship social moment
   ── measure before going further ──
5. Inline "new since last visit"
6. Weekly recap              ← only if data supports it
```

---

## 1. Today → result-led

The single highest-leverage change in the plan. `GroupToday` currently leads with a checklist of who's played. Replace that.

- New top section **"Today's jinxes"**: for each prompt where ≥2 members matched, a hero strip with the answer + matched names. Same reveal-gating as the feed card (blurred until you've played).
- Prompts with no jinx but ≥1 answer get a quieter "X unique answers" tile, breakdown collapsed by default.
- The "who's played" roster collapses to a single one-liner footer: `3/4 in · Sam, Maya, you`.
- Member-name chips and matched-name chips both link to the Pair page.

**Files:** `src/pages/GroupToday.tsx`, small extensions in `src/lib/groups.ts`.

---

## 2. Solo / empty-group magic

Every new user lands in a 1-member group. This is the front door, not a polish item.

- **Mocked sample feed** with 2 example members ("Sam", "Maya") using realistic jinxes drawn from yesterday's actual top answers across the player base. Hard-labelled: *"Preview — this is what your group looks like when friends join"* so it can't read as fake activity.
- **Giant share CTA** replaces the small invite pill: full-width button with the invite preview image (via existing `share-card.ts`) and one-tap Web Share API with copy fallback.
- **Waiting-for-friend state for 2-person groups where only you have played:** show your answers immediately with a "Waiting on Sam" panel that previews the reveal shape. Turns the wait into a moment instead of a dead screen.
- Auto-dismisses once a second member joins / once the friend plays.

**Files:** `src/pages/Groups.tsx`, `src/components/GroupFeedCard.tsx` (solo variant), `src/pages/GroupToday.tsx` (waiting state), `src/lib/groups.ts` (`getSampleHeadlineFromYesterday`).

---

## 3. Group personality

- Add `emoji` and `accent` (one of 6 preset semantic colour names) to `groups`. Both nullable; defaulted in code from a stable hash of the group id so existing groups render correctly without backfill.
- Create-group sheet gains a two-row picker: emoji (8 curated + 🎲 random) and accent swatch (6 swatches). No custom hex.
- `GroupFeedCard` header: `{emoji}` tile in `{accent}/12`, group name beside it, accent tints hero block border.
- Stacked member avatars (overlapping initials circles, max 4 + `+N`) replace the lone tile. Per-member colour is a stable hash of `session_id`, shared across feed card, Today, and Pair page via a new `src/lib/group-visuals.ts` helper.

**Files:** `supabase/migrations/*`, `src/pages/Groups.tsx`, `src/components/GroupFeedCard.tsx`, `src/lib/group-visuals.ts` (new), `src/lib/groups.ts`.

---

## 4. Pair v2 + discoverability

The Pair page is the flagship social artifact. Deepen it, and make it findable.

- **Signature shared answers:** top 3 normalized answers you and the other member have both used (any day, any prompt). Self-join on `answers` filtered to the pair, grouped by `normalized_answer`, count ≥ 2.
- **Rivalry meter:** one-line computed label from `(matchedDays / daysPlayedTogether)` — *Twin* (≥60%), *Sync* (35–59%), *Wildcard* (10–34%), *Opposite* (<10%). Honest because it's derived.
- **Most divisive prompt** sibling to "Best together on": the prompt where you both played and answered most differently (no jinx, highest unique count).
- **Discoverability:** new "Your pairs" row inside each group's Today and History tabs — top 3 highest-jinx pairs as horizontally-scrolling chips that deep-link to `/g/:inviteCode/pair/:otherSessionId`. Without this, the Pair page stays buried.
- Per-pair computations memoised by `(groupId, otherSessionId)` for the session.

**Files:** `src/pages/GroupPair.tsx`, `src/lib/groups.ts` (`getPairSignatures`, `getMostDivisivePrompt`, `getTopPairsForViewer`), `src/pages/GroupToday.tsx` + `src/components/GroupHistory.tsx` (pair chips row).

---

## ── Pause and measure ──

Before building anything below, look at:
- Opens-per-group per active user
- % of group-member sessions that result in a submitted daily set
- Invite-CTA tap → join conversion (instrument in step 2)
- Median jinxes-per-group-per-week (gates step 6)

If these don't move after steps 1–4, the daily prompt loop itself is the bottleneck, not Groups. Stop and fix that instead.

---

## 5. "New since last visit" inline signal

Replaces the original async-nudges plan (dropped — see below).

- Per group, track `lastVisitedAt` in localStorage on Groups tab open.
- Feed card surfaces a small inline pill on the headline when `answersAfter(lastVisitedAt) > 0`: *"2 new since you looked"*. Pill clears when you tap in.
- Bottom-nav Groups dot escalates to a numeric badge of total "new" counts across all groups, capped at 9+.
- No new table, no spoofable mutations, no notification-fatigue risk. Same signal, near-zero infra cost.

**Files:** `src/lib/groups.ts` (lastVisited helpers), `src/components/MobileBottomNav.tsx`, `src/components/GroupFeedCard.tsx`.

---

## 6. Weekly recap — conditional ship

Only build if step-4 measurement shows the median active group hits **≥3 jinxes per week**. Below that threshold, recap reveals dead groups and damages the brand.

If/when it earns its build:
- New route `/g/:inviteCode/recap/:isoWeek`.
- Edge function `group-weekly-recap` computes `{ totalJinxes, topPair, weirdestAnswer, mostJinxedPrompt, mvpMember }` from existing tables. No new tables. Cached client-side per session.
- Swipeable carousel (existing embla via shadcn), one stat per panel, ending with a "Share this week" CTA that hits `share-card.ts` with a recap template.
- Surfaced only as a top-of-`/groups` banner on Sun/Mon for groups meeting the threshold; dismissible per week.

**Files:** `supabase/functions/group-weekly-recap/index.ts`, `src/pages/GroupRecap.tsx`, `src/lib/share-card.ts`, `src/pages/Groups.tsx`, `src/App.tsx`.

---

## Dropped from the original plan

- **Async nudges table + peek banner.** Risk/reward is bad: spoofable session-id mutations on a new table, self-jinx edge cases break the illusion, and an in-app pseudo-notification trains users to ignore it — which would corrode the genuine signal step 5 provides. Step 5 covers the same user need at a fraction of the cost.
- **Pairwise counter chip on Today hero strips.** Defer indefinitely — meaningful only at week 8+ when counts are non-trivial; visually noisy at week 1. Re-introduce later if Pair-page engagement justifies it.

---

## Out of scope (deliberate)

- Renaming/editing groups after creation
- Native push notifications or email
- A cross-group "Discover" feed
- Replacing `/c/:token` one-off challenges — keeps coexisting per memory

---

## Technical notes

- All schema changes are additive, nullable, and defaulted in code. No backfill required.
- Reveal-gating logic stays centralised in `src/lib/groups.ts` — every new surface reuses the same `viewerPlayedToday` predicate.
- A new `src/lib/group-visuals.ts` becomes the single source of truth for emoji/accent defaults and per-session member colour, so feed card, Today, and Pair page can't drift visually.
- Pair computations and "new since last visit" reads piggyback on the existing batched query in `getMyGroups` — no per-card waterfalls.
- The sample-feed for solo groups runs one extra query against yesterday's top public answers, cached for the session.

---

## What this plan does and doesn't claim

It will meaningfully improve Groups — the weakest surface today — and fix the front-door / first-reveal experience that every new user hits. It will not on its own make JINX successful: that still depends on whether the daily Play loop is strong enough that two friends who both play want to play again tomorrow. Steps 1–4 are worth building regardless; steps 5–6 are gated on evidence that the loop is working.
