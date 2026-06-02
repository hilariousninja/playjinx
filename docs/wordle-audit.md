# JINX — Wordle-Scale Audit

A strategic audit of JINX measured against Wordle's proven formula (60-second loop, identical daily puzzle, spoiler-free brag grid, daily reveal moment, zero account friction).

---

## Tier 1 — Existential Blockers

### 1. Share artefact is a PNG, not a paste
Wordle's emoji grid works because you can paste 6 lines into any chat. JINX produces a 1080×1350 PNG that downloads, then asks users to manually attach + paste a caption. Friction is ~5× higher.

**Fix:** Ship an emoji/text share format as the default, keep PNG as a secondary "save card" option. Must be spoiler-free for group chats.

```
JINX #142
🟧🟧⬜  2 jinx / 3
Top 18% of 412 players
playjinx.com
```

### 2. No daily reveal moment
Rolling reveals kill day-1 retention. Early players see almost no crowd, get no JINX, feel nothing.

**Fix:** Pick a fixed reveal time (e.g. 8pm UTC). Before reveal: hide percentages, show "🔒 247 players locked in — reveal in 4h 12m". Push celebration into a single window so groups light up together.

### 3. Cold-start kills day-1 retention
Solo new players see "0 JINX, sample too small", no friends, leave before they understand the loop.

**Fix:**
- Show the previous day's matured crowd as their "result" instantly so the magic lands on play #1.
- Force a friend ask with a reward after first result ("invite 1 friend to unlock your group view").

### 4. PWA / install / re-engagement missing
No manifest, no install prompt, no push, no email. Wordle survived because iMessage threads did re-engagement work for it — JINX has no equivalent loop.

**Fix:**
- PWA manifest + install prompt after first JINX moment.
- Web Push for group events ("Andy just jinxed you").
- Optional email digest for users without push.

---

## Tier 2 — High-Leverage Polish

### 5. Landing wastes the first moment
Three surfaces (hero, explainer, CTA) before the user can type a word.

**Fix:** Show the first prompt directly on Landing as playable. Onboarding shrinks to a single tooltip after their first answer.

### 6. SEO / OG broken
- `index.html` still carries `class="dark"` while the app is Cream/Amber.
- OG image is a Lovable placeholder.
- No per-day public archive pages for indexing or link previews.

**Fix:** Branded OG image, correct theme class, per-day archive pages with proper OG cards and canonical URLs.

### 7. Scoring is fuzzy
JINX-count, match-count, rank, percentage, provisional lead, top-answer — it's a thicket. New users can't tell what "winning" means.

**Fix:** Pick one hero number (e.g. "2 JINX / 3"). Everything else goes in a drawer.

### 8. Group payoff lacks a "first" moment
When a JINX happens inside a group, nothing celebrates it.

**Fix:** Full-bleed animation on first jinx of the day, one-tap share-to-group-chat, track "first jinx of the week" as a recurring micro-trophy.

---

## Tier 3 — Strategic Surface Area

### 9. Asynchronous social is BeReal-shaped, not Wordle-shaped
Groups are the moat. Wordle has none — JINX should lean in, not hide it.

**Fix:** For users in ≥1 group, default landing route is `/groups`. Play is the price of admission to the group view.

### 10. Streaks are local-only and fragile
Lives in localStorage. Clear cookies = lost streak. No portability across devices.

**Fix:** Persist server-side keyed by canonical session identity, with optional magic-link email backup.

### 11. No "I'm uniquely me" moment
Wordle never had this — JINX can.

**Fix:** "Unique" badge when you're the only person with a given answer. Lives next to JINX count in the share grid.

### 12. Archive is dead inventory
Replaying old puzzles has the same cold-start problem as day-1 play.

**Fix:** Use Archive as onboarding tutorial. Curated highlight reel ("the day everyone said hammer + movie"). Frame as social history, not stale content.

---

## Recommended Sprint Order

| Sprint | Focus |
|---|---|
| 1 | Emoji share grid + fixed daily reveal time |
| 2 | PWA + push notifications + fix OG/index.html |
| 3 | Landing-as-first-prompt + hero scoring number |
| 4+ | Groups-first homepage, server-side streaks, unique badge, archive-as-tutorial |

---

## Open Questions

1. **Reveal time** — global 8pm UTC, or per-timezone local 8pm? Global creates a true "moment"; local feels personal but fragments the crowd.
2. **Identity layer** — magic-link email on top of session-id, or stay session-only? Email unlocks cross-device + re-engagement but adds friction.
3. **Positioning** — compete on Wordle territory (solo brag grid) or double down on the BeReal-shaped private-group loop? The two answers point at very different roadmaps.
