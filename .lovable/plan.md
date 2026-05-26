# Addendum to Groups overhaul roadmap

Two new phases fold into the existing plan. Both are pure presentation work — no data, schema or business-logic changes.

---

## Phase 1.5 — Fix Groups empty-state hierarchy

**Problem (image 1)**
Three stacked "intro" layers say the same thing:
1. Page H1 `Groups`
2. Subtitle `Same prompts, same people, every day.`
3. Card H2 `Play JINX with your people`
4. Card sub `Same prompts, every day. See who thinks like you.`

The page header and the card header compete. There is no single focal point and the CTA sits below the visual fold of redundancy.

**Fix — collapse to one hero, only when empty**

When `groups.length === 0 && !showCreate`:

- Hide the page-level `Groups` H1 + subtitle.
- Promote the card to the only hero. Tighten copy:
  - Title: `Play JINX with your people` (kept, larger — `text-[18px]`)
  - Sub: removed (the title carries it).
- Card body becomes: title → one-line value prop `See who in your crew thinks like you.` → primary CTA → secondary "Join with invite link".
- Add a small example strip under the card (static, no data): `Sam · Maya · You — 2 jinxed yesterday on "mistake + river"` to give the empty state something concrete instead of pure marketing copy.

When `groups.length > 0`:

- Keep the existing compact `Groups` H1 + `New` action. No change.

Files: `src/pages/Groups.tsx` only.

---

## Phase 1.6 — Consolidate Results page summary stack

**Problem (image 2)**
Above the first answer card the page stacks five summary blocks that mostly restate the same two facts (`1/3 matched`, `1 JINX`):

1. `BragBlock` hero — "1/3 in sync · One prompt synced with the crowd · 1 JINX · Best hit DROWN · 50%"
2. JINX reward strip — "⚡ 1 JINXes today · 1/3 matched · 83 total · 13 this week"
3. 3-stat row — "⚡1 JINXes · 1/3 Matched · 1 #1 answers"
4. Streak row — "🔥 2-day streak"
5. Then `HOW THE CROWD VOTED` and the cards

`matched`, `jinx count` and `top answer` each appear 2–3 times. The eye has no resting point and the answer cards (the actual payoff) are pushed below the fold.

**Fix — one hero, one meta line, then cards**

Reduce to two blocks above the prompt list:

1. **Hero (`BragBlock`, kept)** — owns: rank phrase, best-hit answer + %, JINX count, matched count. Add a single inline `🔥 2` streak chip in the hero's bottom-right corner so the streak row disappears. No changes to `BragBlock` logic, only a small `streak` prop.
2. **Meta line (new, replaces blocks 2 and 3)** — one row, `text-[11px] text-muted-foreground`, format:
   ```
   83 total jinxes · 13 this week · 🔥 2-day streak
   ```
   This is the only place lifetime/weekly/streak numbers appear. Today's numbers belong to the hero.

Remove entirely:
- The JINX reward strip (`dayJinxes > 0` block) — fully redundant with hero.
- The 3-stat row — duplicates hero facts.
- The standalone streak row — folded into meta line.

Keep:
- Provisional-lead notice (only renders when `dayJinxes === 0 && provisionalLeads > 0`) — different information.
- Low-sample notice (only renders when sample < 10) — different information.
- `HOW THE CROWD VOTED` section header + answer cards.
- `Share results` / `Challenge a friend` / `Next prompts in:` footer block.

Result: above-the-fold becomes `hero → meta line → first answer card`. The crowd-voted answer cards are the visual payoff, not a footnote under four stat blocks.

Files: `src/pages/Results.tsx`, `src/components/BragBlock.tsx` (add optional `streak` prop).

---

## Sequencing

Slot both phases into the existing roadmap as low-risk visual cleanup:

```text
Phase 1   Today → result-led               (done)
Phase 1.5 Groups empty-state hierarchy     (new — small)
Phase 1.6 Results summary consolidation    (new — small)
Phase 2   Solo/empty-group magic           (done)
Phase 3   Group personality                (done)
Phase 4   Pair v2 + discoverability        (in progress)
Phase 5   New-since-last-visit             (mostly done)
Phase 6   Weekly recap                     (gated)
```

1.5 and 1.6 are independent of each other and of the in-flight Phase 4 work, so they can ship in either order without coordination.

---

## Technical notes

- `BragBlock` already accepts a wide prop set; adding `streak?: number` is additive and defaulted, no callers break.
- No new components, no new hooks, no new queries.
- All copy strings live alongside their components — no i18n table to touch.
- The example strip in Phase 1.5 is hard-coded static markup (it is an illustration, not real data) so it cannot drift or mis-render for new users.
