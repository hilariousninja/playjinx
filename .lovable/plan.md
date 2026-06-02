# JINX — Wordle-Scale Audit

Wordle won on five things: **(1)** 60-second loop, **(2)** identical puzzle for everyone, **(3)** a spoiler-free brag grid that paste into iMessage, **(4)** a daily reveal moment everyone hits at the same time, **(5)** zero account friction. JINX has 1 and 5 covered. Below is everything else, ranked by how much it's costing growth.

---

## Tier 1 — Existential blockers (fix these or growth caps)

### 1. The share artefact is a PNG, not a paste
Wordle's grid works because you can paste 6 lines of emoji into any chat and it renders inline as a tease. JINX currently produces a 1080×1350 PNG that downloads, then asks the user to manually attach + paste a caption. Friction is ~5× higher and the receiver sees an image attachment (skippable) instead of an inline grid that begs for a reply.

**Fix:** Ship an emoji/text share format as the default:
```
JINX · Tue 27 May
⚡⚡  ·  ·  ⚡⚡⚡
2 JINX · 7-day streak
playjinx.com
```
Keep the PNG as a secondary "save card" option. The emoji line must be spoiler-free (no answers, no word pairs) so it works in group chats without ruining the puzzle for friends.

### 2. There is no daily reveal moment
Wordle/Connections/Strands all benefit from "everyone solves before lunch, then talks about it". JINX has rolling reveals — if I play at 7am I see almost no crowd, get no JINX, feel nothing, and don't come back. The "early results" warning is honest but it's a downer.

**Fix:** Pick a fixed **reveal time** per day (e.g. 8pm local, or 8pm UTC). Before reveal: hide percentages and ranks, show "🔒 247 players locked in — reveal in 4h 12m". Push the celebration into one window. This single change also creates a natural push-notification hook.

### 3. Cold-start kills day-1 retention
A solo new player on day 1: lands, plays 3 prompts, sees "0 JINX, sample too small", no friend in any group, leaves. They never come back because the entire payoff is social.

**Fix:** Two pieces in tandem:
- **Synthetic crowd on first session.** Show day-1 players the prior day's matured crowd distribution as their "result" (still showing their own answer's rank against it). They feel the mechanic instantly.
- **Forced friend ask, with reward.** After first result: "Add 1 friend to see who in your life thinks like you. We'll text them the link." Default the CTA to share, not skip.

### 4. PWA / install / re-engagement is missing
No manifest, no install prompt, no push, no email. Wordle survived because iMessage threads did the re-engagement work for it — but Wordle players were 40+ year-olds who already texted daily. JINX's audience won't reliably do that. You need owned re-engagement surfaces.

**Fix:** PWA manifest + install prompt after first JINX. Web Push for "Steph just played W4 E20" and "Your reveal is in 1 hour". Optional email digest for groups.

---

## Tier 2 — High-leverage polish (fix in the next 2 sprints)

### 5. Landing wastes the first moment
Right now Landing is a card explaining the mechanic, then a CTA to /play, then Onboarding overlays /play with another 2-step explainer. That's **3 surfaces** before someone enters a word. Wordle gives you the grid on first paint.

**Fix:** Show the first prompt directly on Landing as a playable interactive card ("Try one"). Submitting it auto-routes to /play for the remaining two. Onboarding becomes a single tooltip on the first card, not a full-screen overlay.

### 6. SEO and OG are broken
- `index.html` still has `class="dark"` on the root html element while the app is Cream/Amber — flash of wrong theme.
- The OG image is a Lovable preview URL placeholder, not a JINX-branded card. Every link shared to Twitter/Discord/Slack right now is undermining the brand.
- Each day's puzzle has no shareable URL beyond `/c/:token`. There's no SEO catch for "what links cow and snow" type queries.

**Fix:** Branded OG image (use the existing share-card.ts renderer to generate a daily one server-side), strip `class="dark"`, add per-day public archive pages (`/archive/2026-05-27`) indexed and OG-cardable for organic search.

### 7. Scoring is fuzzy
Wordle's "4/6" is parseable in a glance. JINX uses JINX-count, match-count, rank, percentage, provisional lead, top-answer — it's a thicket. A new player can't summarise their day in one number to a friend.

**Fix:** Pick one hero number. "**2 JINX / 3**" is the simplest. Keep the rest in the drawer. Make the brag block read as "2 of 3 — synced with the crowd" not five badges.

### 8. Group payoff lacks a "first" moment
Groups are clearly the moat, and the recent feed work is great. But the first time two members JINX, it's just another card. That's the dopamine event of the whole product and it should feel like one.

**Fix:** When a JINX happens in a group, fire a celebratory full-bleed animation on first view ("⚡ JINX! Andy & Jourdain both said Milk"), with a one-tap share-to-group-chat. Track "first jinx of the week" specifically.

---

## Tier 3 — Strategic surface area (medium-term)

### 9. Asynchronous social is BeReal-shaped, not Wordle-shaped
JINX's actual social loop resembles BeReal more than Wordle: small private groups, daily check-in, see what your people did. That's a stronger long-term position than competing on Wordle's solo bragging. Lean into it: the homepage for returning users should be the **Groups feed**, not Play. Play is the price of admission to see your group's results.

**Fix:** For users in ≥1 group, default landing route is `/groups`. Today's prompts are surfaced as a card at the top of that feed. Play stops being the centre of gravity.

### 10. Streaks are local-only and fragile
Streak lives in localStorage. Clear cookies = lost streak = lost player. We've already seen identity drift problems (the Jourdain bug). Streaks must survive device changes.

**Fix:** Persist streak server-side keyed by canonical session, surface it on profile, and add a one-time "save your streak" prompt that offers magic-link email backup. This also gives an email list for digests.

### 11. No moment of "I'm uniquely me"
Wordle never had this; Connections does ("I got purple"). JINX could: when you're the only person with a given answer, that's interesting. Right now it's just rank #5 with 1 vote.

**Fix:** "Unique" badge — "You were the only one who said *bellows*." That's shareable and identity-forming.

### 12. Archive is dead inventory
The Archive tab is a list of past puzzles. Replaying old puzzles solo has the same cold-start problem as day-1: no live crowd, no payoff.

**Fix:** Use Archive as **onboarding tutorial**. Tutorial = play 3 archived prompts with mature crowd data so the mechanic clicks before day 1.

---

## Recommended order of operations

```
Sprint 1  (1 week)  → Tier 1: emoji share grid + reveal time + cold-start crowd seed
Sprint 2  (1 week)  → Tier 1: PWA + push for groups; Tier 2: fix OG/index.html
Sprint 3  (1 week)  → Tier 2: landing-as-first-prompt, hero scoring simplification
Sprint 4+           → Tier 3: groups-first homepage, server-side streaks, unique badge
```

If I had to pick **one** thing to ship first, it's the **emoji share grid + scheduled reveal time** as a pair. Together they create the Wordle-style "everyone hits at 8pm and posts a teaser" loop that nothing else in the audit substitutes for.

---

## Open questions before building

- Reveal time: global 8pm UTC, or per-timezone local 8pm? (Local is friendlier; global creates a shared moment.)
- Do you want a magic-link email layer added now, or keep the session-id-only identity model?
- Is competing on Wordle territory (solo brag) the goal, or doubling down on the BeReal-shaped private-group loop?
