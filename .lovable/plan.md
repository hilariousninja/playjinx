# Groups upgrade: feed-led list + Pair page

Two things ship together: a new `/groups` that reads like a chat list (latest jinx headline per group, with a "play to reveal" tease when you haven't played), and a new Pair page that turns any one-to-one relationship inside a group into its own little leaderboard.

The locked design system stays: amber primary, cream bg, Space Grotesk, 360–390px mobile-first, semantic tokens only.

---

## 1. /groups as a feed

Each group card becomes a single tappable feed item built around **the latest jinx moment in that group**.

**Card anatomy (top → bottom):**
- Tiny header strip: group name + status pill (Live / All-in / Quiet) + stacked member avatars
- Hero block — the headline, depending on viewer state:
  - **You've played today AND ≥1 jinx exists today** → "TURTLE + JACKET → both said **GREEN** ⚡" with the two matched players named ("You × Sam")
  - **You've played, no jinx today** → "TURTLE + JACKET — no jinx today" + small breakdown ("4 unique answers")
  - **You haven't played today** → "TURTLE + JACKET — **3 people answered**" with the answer area blurred + amber "Play to reveal" pill. Curiosity hook without spoiler.
  - **Today not set up / nobody played** → fall back to a quieter prompt: "Nobody's played yet" + nudge CTA
- Footer chrome: "N/M today", invite icon, leave icon (hover-reveal)

**Sort order:** unread jinxes (others played, you haven't) first → live (someone played today) → quiet → solo.

**Empty state stays as-is** (it already works), but the populated state is fully replaced.

## 2. Pair page (you × one friend)

New route: `/g/:inviteCode/pair/:otherSessionId`

Reachable from:
- Tapping any other member's avatar on the group card
- Tapping a name in the Today / History views

**What it shows:**
- Header: "You × Sam" with both avatars
- Big stat trio: total jinxes together · days played together · current streak (consecutive days both played)
- Today strip: today's prompts with both your answers side-by-side (gated — same reveal rules as the feed card; if either hasn't played, that prompt is masked)
- Recent jinxes feed: last ~10 prompts where you matched, prompt + matched answer + date
- Footer: "Best together on JACKET prompts" (most-jinxed word, if signal exists)

All data already exists — `computeGroupLifetimeStats` in `src/lib/groups.ts` already walks every answer pair and computes per-pair jinx counts. We extract a `getPairData(groupId, sessionIdA, sessionIdB)` helper that reuses the same scan and returns:
```
{ totalJinxes, daysPlayedTogether, currentStreak, recentJinxes[], topPromptWord }
```

## 3. Today preview helper

To power the feed headline we add `getGroupTodayHeadline(groupId)` in `groups.ts`:
- Pulls today's prompts + this group's answers (same query path as `getGroupDayResults`)
- Returns `{ promptPair, viewerPlayed, jinxAnswer | null, jinxNames | null, answeredCount, totalMembers }`
- Called inside `getMyGroups` so each `GroupWithActivity` carries a `todayHeadline` field — one extra batched query, not per-card waterfalls.

## 4. Files touched

- `src/lib/groups.ts` — add `getGroupTodayHeadline`, `getPairData`; extend `GroupWithActivity` with `todayHeadline`
- `src/pages/Groups.tsx` — replace the populated card block with the new feed card; keep empty state, create form, leave confirm
- `src/components/GroupFeedCard.tsx` *(new)* — the headline card with all four viewer states
- `src/pages/GroupPair.tsx` *(new)* — the Pair page
- `src/App.tsx` — register `/g/:inviteCode/pair/:otherSessionId`
- `src/components/GroupHistory.tsx` and `src/pages/GroupToday.tsx` — make member-name chips link to the Pair page (small additive change)

No DB migration needed. No design-token changes. No new dependencies.

## 5. Out of scope (deliberately)

- Sharing/screenshot cards for groups — confirmed not the goal here
- Weekly recap, async push nudges, group personality (emoji + accent at creation) — these are the follow-ups after this lands
- Renaming/editing groups

---

### Technical notes

- Pair data: extract the inner loop of `computeGroupLifetimeStats` into a shared scan that takes an optional `pairFilter: [sidA, sidB]`. Avoids a second full-table walk.
- Reveal gating reuses the same "have I answered today" check already used in `GroupHistory.tsx` (`myAnsweredDates`).
- Avatar colours: derive a stable color from `session_id` hash so the same friend looks the same across cards.
- Realtime: subscribe `getMyGroups`'s answer query channel so a new jinx in another group bumps that card to the top while you're sitting on /groups.
