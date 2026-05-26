# JINX — Design Reference

> An exhaustive internal reference for **playjinx.com**. The intended reader is future-you: someone returning to this codebase after weeks away who needs to remember not just *what* exists but *why*. Every screen, mechanic, and visual decision is documented alongside the alternatives we rejected.

**Last meaningful update:** Phase 5 (visit tracking polish), Members tab on Group screen.

---

## Table of contents

1. [Mission & north star](#1-mission--north-star)
2. [Design philosophy](#2-design-philosophy)
3. [Audience & use cases](#3-audience--use-cases)
4. [Visual identity (V8)](#4-visual-identity-v8)
5. [Information architecture](#5-information-architecture)
6. [Screen-by-screen reference](#6-screen-by-screen-reference)
7. [Core game mechanics](#7-core-game-mechanics)
8. [Social layer](#8-social-layer)
9. [Creator dashboard philosophy](#9-creator-dashboard-philosophy)
10. [Copy & voice](#10-copy--voice)
11. [Decision log](#11-decision-log)
12. [Anti-patterns & guardrails](#12-anti-patterns--guardrails)
13. [Open questions & future considerations](#13-open-questions--future-considerations)
14. [Glossary](#14-glossary)

---

## 1. Mission & north star

JINX is a **daily crowd prediction game**. Every day, three two-word prompts are published (e.g. **MISTAKE + RIVER**). Players write the first single-word answer that bridges the two. They don't win by being clever; they win by matching the crowd — and especially by matching their friends.

The product has two faces:

- **The player app** (`playjinx.com`) — public, social-first, mobile-first.
- **JINX Creator** (`/dashboard`) — a private curation suite that maintains the word bank used by the game *and* by a parallel physical board game deck.

### North-star sentence

> *"Did you say the same thing as your mates?"*

Every design decision laddered to this sentence. If a feature serves it, it stays. If a feature only serves "did you score well?" or "how clever was your answer?", it gets cut or hidden.

### Success looks like

- A user opens the app once a day, plays in under 60 seconds, and immediately wants to know what their group/friend said.
- Groups develop a shared running joke: "of course Andy said *drown* again."
- The word bank grows in quality (not just size) week over week, governed by evidence rather than vibes.

### Failure looks like

- The app feels like Wordle's analytical cousin (streaks, score tables, optimal play).
- The Results screen becomes a personal stats dashboard.
- New groups never get past the first day because the first solo session feels empty.

---

## 2. Design philosophy

Four principles, in priority order. When they conflict, the earlier one wins.

### 2.1 Crowd prediction, not puzzle-solving

There is no correct answer. There is only the answer most people gave. This is a meaningful framing choice — it changes who feels smart (people who know other people, not people who know words), and it makes losing impossible to feel bad about.

**How this shows up:**

- The Play screen never says "correct" or "wrong."
- Results lead with crowd consensus, not with personal score.
- We avoid the word "guess." Players *answer*, *predict*, *match*.
- Hint mechanics, time pressure, and difficulty ladders are explicitly off-limits.

### 2.2 Social payoff over stats

A friend's reaction beats a number every time. We deliberately suppress lifetime stats, leaderboards, and personal accuracy metrics in favour of *did Sam say the same thing as you today?*

**How this shows up:**

- No global leaderboard. No "Jinx rating." No accuracy %.
- The Brag Block on Results is a screenshot-friendly summary you'd want to send a friend, not a personal report card.
- The Group screen leads with *who jinxed with whom today*, not aggregate stats.
- The Pair page exists at all (one-on-one comparison) because that's where the joy lives.

### 2.3 Honesty over hype

Activity bars must reflect reality. Empty states must look empty. "New since last visit" badges must clear immediately. Nothing is gamified through fake urgency or fake popularity.

**How this shows up:**

- Group cards show *truthful* activity tints based on aggregate data, never a permanent "🔥 Active!" badge.
- Empty group history says "No jinxes yet" — not "Be the first to jinx!"
- Daily Set Integrity: once even one player has answered, the daily set cannot be regenerated. No "oops, let me swap a prompt."

### 2.4 Mobile-first, thumb-first

Designed on a 390×844 reference frame. Every interaction is reachable with one thumb. Desktop is a courtesy view, not the target.

**How this shows up:**

- 3-tab bottom nav, 52 px header (memorable proportions).
- Single-screen play loop — no tabs, no scroll-to-find-input.
- Drawers (vaul) and slide panels for secondary surfaces, not modal dialogs.
- Touch targets ≥ 36 px tall.

---

## 3. Audience & use cases

### 3.1 Primary persona — *Raj and his group chat*

Mid-20s to mid-30s, plays Wordle/Connections daily, has 1–2 group chats where they already share daily puzzle results. They want the social wrap-up *without* the maths discussion afterwards.

**Job-to-be-done:** "Give me 60 seconds of fun and a screenshot worth sharing."

### 3.2 Secondary persona — *The recurring group*

5–8 close friends or family members who join a private group (e.g. "W4 E20") and play every day. The group becomes a low-effort daily ritual. We optimise heavily for this segment because they drive retention.

**Job-to-be-done:** "Show me what my people said today."

### 3.3 Tertiary persona — *The board-game buyer*

The eventual purchaser of the physical JINX deck. They never see the Creator dashboard, but the dashboard's quality controls make their deck better.

### 3.4 Creator persona — *Raj as admin*

A single admin (rajan.p@hotmail.co.uk) curates the word bank, reviews suggestions, balances categories, and decides which words ship in the next physical deck. Spends 15–30 min per week in the Creator dashboard.

**Job-to-be-done:** "Tell me which words are pulling their weight, and which should be cut."

---

## 4. Visual identity (V8)

The "V8" theme is the eighth and current iteration of the visual identity. Earlier versions (V1–V7) trended too playful (cartoony purple), too corporate (neutral grey), or too gamey (neon green on black). V8 splits the difference: warm, editorial, calm.

### 4.1 Color system

All colors live as HSL tokens in `src/index.css` and are surfaced as semantic Tailwind classes. **Never write raw hex or `text-white`/`bg-black` in components.**

| Token | Light value | Use |
|---|---|---|
| `--background` | Cream `#F6F4EF` | App body |
| `--foreground` | Near-black `#1A1A1A` | Body text |
| `--card` | White `#FFFFFF` | Result tiles, group cards |
| `--primary` | Amber `#D97706` | All "JINX!" energy, primary CTAs, jinx chips |
| `--primary-foreground` | White | Text on amber |
| `--muted` | Warm grey | Tab background, subtle dividers |
| `--muted-foreground` | Soft grey | Captions, secondary text |
| `--destructive` | Rust red | Leave-group confirm only |
| `--border` | Hairline warm grey | All borders |

**Amber is sacred.** It only appears for jinx events, the primary CTA, and the JINX logo bolt. Using amber for a generic "info" state dilutes the moment.

**Creator dashboard runs a separate palette** — off-white background, soft grey borders, blue (not amber) accents. The Creator surface is deliberately dry and analytical so it can't be mistaken for the player app.

### 4.2 Typography

- **Display:** Space Grotesk (700 / 600) — answers, prompt words, group names.
- **Body:** Space Grotesk (500 / 400) — UI text.
- **Mono:** system monospace — Creator dashboard data tables only.

Why one family: typographic variety would compete with the chromatic restraint. Space Grotesk has enough character at display sizes to carry headlines without a paired serif.

**Sizing scale (mobile defaults):**

| Role | Size | Weight |
|---|---|---|
| Page title (e.g. "JINX") | 52 px | 700 |
| Section title (prompt word, group name) | 18 px | 700 |
| Answer hero (e.g. *drown*) | 18 px | 700 |
| Body text | 12 px | 400/500 |
| Caption | 10 px | 600 |
| Microlabel ("YOU JINXED") | 9–10 px, uppercase, +tracking | 700 |

The 52 px header is intentionally aggressive on mobile — it asserts the brand and anchors the layout. It does *not* scale down at smaller widths.

### 4.3 Spacing, radii, shadows

- **Radii:** 7–12 px for tiles, 8–10 px for buttons, full pill for chips. Cards never use sharp corners.
- **Shadows:** Almost none. A single `shadow-sm` on the active tab pill. Depth is implied through borders, not elevation.
- **Spacing rhythm:** 10 / 12 / 14 px vertical gaps. We don't use the default Tailwind 4/8 px ladder — the custom rhythm reads denser and more "designed."

### 4.4 Iconography & motion

- **Icons:** Lucide React, mostly 12–14 px on mobile. Stroke weight default.
- **Motion:** Framer Motion. Two patterns only — *fade-up-6px on mount* for cards (with 40 ms stagger), and *spring scale 0.97* on press for primary CTAs. No parallax, no scroll-triggered animations, no celebratory confetti. The amber jinx-fill *is* the celebration.

### 4.5 Member visual identity

Members get auto-assigned colors and initials via `src/lib/group-visuals.ts`. The palette is intentionally muted (rose, sage, violet, slate) so it never competes with primary amber. Two-letter initials, never one. "You" is always shown as amber-tinted regardless of assigned color.

---

## 5. Information architecture

### 5.1 Three modes

The entire player app collapses into three persistent modes, surfaced through a bottom nav:

```text
┌──────────┬──────────┬──────────┐
│   Play   │  Groups  │ Archive  │
└──────────┴──────────┴──────────┘
```

- **Play** — today's prompts, plus your post-play Results.
- **Groups** — list of recurring groups + creator monitoring cards for one-off challenge rooms.
- **Archive** — past days, crowd results, late-play option.

Why three and not four: a fourth tab (Profile / Stats) was rejected three times during V5–V7 because it always became a stats dashboard, violating principle 2.2.

### 5.2 Header

A fixed 52 px header with the JINX wordmark on the left and a player identity pill on the right (avatar + display name). The header never changes between modes — it's the user's anchor.

### 5.3 Navigation layers

Two secondary surface types, with strict z-index discipline:

| Surface | Pattern | z-index | Purpose |
|---|---|---|---|
| Slide panel | Full-screen slide-in from right | 50 | Pair page, group join flow |
| Bottom sheet | vaul drawer | 60 | Confirmations, share menus |
| Toast | top-right | 100 | Ephemeral feedback |

Modals (centered dialogs) are avoided on mobile — they trap the thumb away from the natural reach zone. Used only in the Creator dashboard.

---

## 6. Screen-by-screen reference

Each entry follows the same shape: **Purpose · Layout · Key decisions · Rejected alternatives.**

### 6.1 Landing (`/`)

**Purpose:** Convert a first-time visitor into a player in one tap.

**Layout (top-to-bottom):**
1. Brand block — JINX logo + tagline.
2. Hook — "Match the crowd. Jinx your mates."
3. Primary CTA — "Play today's JINX."
4. Live example — yesterday's most-jinxed prompt as a static card.

**Key decisions:**
- No login wall. Players get a `session_id` in localStorage and play immediately.
- Example uses *yesterday's* data, not today's, so we never spoil today's prompts.
- One CTA, never two. Secondary "How to play" was tested in V6 and reduced primary CTR by ~22%.

**Rejected:**
- Hero video of someone playing (felt like a SaaS marketing site).
- "Sign up to save your streak" — would have violated principle 2.2 by making the entry point about stats.

### 6.2 Play (`/play`)

**Purpose:** Get an answer for each of today's three prompts, one screen, minimum friction.

**Layout:** Single scrollable column. Each prompt is a card. The active card auto-scrolls its input into view and auto-focuses. Submitting advances to the next card.

**Key decisions:**
- All three prompts visible on one screen (vs. one-per-screen tabs). This reduces commitment anxiety — players see the whole task up front.
- Input field is **below** the prompt words, not above, so the keyboard rising doesn't obscure the prompt.
- We accept multi-word answers but normalise to a single canonical form (see §7.4). The placeholder still says "one word" because that produces better data.
- After all three are answered, the page replaces itself with Results in-place (no navigation). Back-button never returns to a half-filled state.

**Rejected:**
- A countdown timer per prompt (violates principle 2.1).
- A "skip" option (creates messy data and erodes the daily ritual).
- Showing crowd preview before submission (would change the answer).

### 6.3 Results

**Purpose:** Deliver the social payoff. Make a screenshot-worthy artifact in under three seconds.

**Layout, in order:**
1. **Brag Block** — large card with the day's headline outcome ("You jinxed 2/3 today!") suitable for screenshotting and sharing.
2. **Per-prompt breakdown** — each prompt as a tile showing your answer + crowd's top answer, with a colored left border (amber if you jinxed, neutral if not).
3. **Social paths** — "Send to a friend" (creates a `/c/:token` challenge link) and "Share to a group" (existing groups).
4. **CTA hierarchy** — primary: "Share." Secondary: "See full crowd." Tertiary: "Back to archive."

**Key decisions:**
- Brag Block sits *above* per-prompt detail so users who only want the headline don't have to scroll.
- Colored left border (4 px) is the only celebratory chrome. We removed background tints on tiles in V7 — they made the page too busy.
- "See full crowd" is a soft secondary link, not a button, because most users don't care.

**Rejected:**
- A trophy/badge for "perfect jinx day." Earned-stickers framing pulls toward puzzle-solving.
- Stacked-bar visualisation of crowd consensus. Read tests showed users skimmed past it.

### 6.4 Archive (`/archive`)

**Purpose:** Browse past days. Catch up if you missed a day. View full crowd consensus retroactively.

**Layout:** Reverse-chronological feed. Each day is a card. **Late play** is supported: if you didn't play day N, you can still play it from the archive, but your answer is flagged as `late=true` and excluded from that day's official crowd consensus.

**Day Feed Hierarchy** (shared with the Today card on Groups):
- Header: date + your jinx count if you played.
- Body: per-prompt mini-rows.
- Footer: "View crowd results" link.

**Rejected:**
- Calendar grid view (works for Wordle's binary outcome but not for our richer day-card).
- "Streaks" — banned by principle 2.2.

### 6.5 Groups hub (`/groups`)

**Purpose:** Show all the user's active social contexts at a glance.

**Layout:** Vertical list of:
1. Recurring groups they belong to (e.g. "W4 E20") rendered as `ActiveGroupCard`.
2. One-off challenge rooms they *created* (rendered as `MyRoomCard`) so they can monitor recipients.
3. Empty state if neither exists: a `SampleGroupPreview` showing what a populated group looks like.

**Key decisions:**
- Recurring groups appear above one-off rooms. Groups are the retention engine; rooms are throwaway.
- Each card shows a *truthful* activity bar (tinted amber if there's been activity today, neutral otherwise) rather than a fake "active" badge.
- Bottom-nav badge: a small dot when any group has new activity since last visit. The dot is computed live via `useGroupNewCount()` and clears the moment the user enters a group screen.

**Rejected:**
- A "discover public groups" feed. Public groups violate the small-circle premise.
- A search bar (no one has enough groups to need search).

### 6.6 Group Today (`/g/:inviteCode`)

**Purpose:** Show today's results for this group, leading with jinx celebrations.

**Layout:**
- Group header (avatar, name, "N members · M/N played").
- Three-tab nav: **Today / Members / History.**
- **Today tab:**
  - If not played: "Your turn" CTA card.
  - `GroupTodayFeed` — result-led: each prompt is a tile. Tiles with a jinx (≥2 members agreed) get an amber-tinted hero strip showing the jinxed answer + member chips. Tiles without a jinx are quiet "N unique answers" tiles, expandable to reveal the answers.
  - When viewer hasn't played, the whole feed blurs and shows a "Play to reveal" lock — prevents spoiler leakage.
  - One-liner roster footer ("4/6 in · Andy, Ellie, Sally, you").
  - Crowd results link.

**Key decisions:**
- **Result-led, not roster-led.** Earlier iterations led with the member roster, which made non-jinx days feel empty. Leading with results means even a quiet day has structure.
- **Member chips on jinx hero are clickable** → take you to the Pair page for that member.
- **Late play allowed** — if you play after midnight, you still appear in today's group feed (until the next daily set rotates in).

**Rejected:**
- A live "X is playing now" indicator. Felt creepy and lied half the time.
- Showing other members' answers before viewer has played (spoiler risk).

### 6.7 Group Members (`/g/:inviteCode` → Members tab)

**Purpose:** A full, scannable view of everyone in the group with their pair-with-you stats. Replaces the old horizontal `PairChipsRow` (which scrolled out of view at 5+ members).

**Layout:** Vertical list, one row per other member, sorted by jinx count desc:
- Avatar (auto-color) + initials.
- Display name.
- Subtitle: rivalry label (Twin / Sync / Wildcard / Opposite) · last jinx date.
- Trailing: `⚡ N JINXes` + chevron → Pair page.

**Key decisions:**
- Includes members with 0 jinxes (they're still in the group; hiding them felt punitive).
- Sort is jinx count desc, then days-together desc, then name asc.
- Empty state for groups of 1 prompts an invite.

### 6.8 Group History (`/g/:inviteCode` → History tab)

**Purpose:** Browse past group days. Same Day Feed Hierarchy as the Archive.

**Layout:** Reverse-chronological list of past group days, each summarising the jinxes that happened.

### 6.9 Group Pair (`/g/:inviteCode/pair/:sessionId`)

**Purpose:** Two-person deep dive — "what's the running story between me and Andy?"

**Layout:**
1. Header: both avatars + names + total jinx count.
2. **Rivalry meter** — Twin / Sync / Wildcard / Opposite with progress bar + contextual blurb.
3. **Shared signatures** — top-3 normalized answers you've both used, with `×occurrences` badges.
4. **Most divisive prompt** — `PromptPair` block, with "You" vs "Them" columns.

**Key decisions:**
- This page is the spiritual centre of the social layer. The Group Today screen exists to funnel users here.
- Loaded via parallel `Promise.all` of `getPairData` + `getPairEnrichment` so the page feels instant.

### 6.10 Challenge landing (`/c/:token`)

**Purpose:** A first-time visitor lands here from a friend's shared link. Convert to player.

**Layout:** Friend's name + their day-summary (anonymised on the headline), CTA to "Play & compare."

**Key decisions:**
- `/c/:token` links are perpetually valid for that specific daily set, even after the day ends. This is critical — friends share links at all hours and the experience must still work tomorrow.
- After playing, the user lands on Challenge Compare, not Results.

### 6.11 Challenge compare (`/c/:token/compare`)

**Purpose:** Direct head-to-head with one friend, Wordle-share format.

**Layout:** Side-by-side per-prompt columns (You | Them) with jinx/no-jinx amber chrome.

### 6.12 Creator dashboard (`/dashboard`)

Five tabs: **Overview · Tuning · Answers · Insights · Data.** See §9 for the philosophy. Visually it's a different app: off-white background, soft grey borders, blue accents, no amber, no Space Grotesk display sizes. This separation is intentional — the Creator is admin tooling, not the product.

---

## 7. Core game mechanics

### 7.1 One answer per day policy

**Rule:** Each player submits exactly one set of answers per daily prompt set. That single set is reused across every social context — solo Results, every group they're in, every `/c/:token` challenge that points at that day.

**Why:**
- Prevents "optimising" an answer after seeing crowd hints in one context.
- Means a friend's link cannot be gamed by replaying.
- Simplifies the data model — one row of answers per (`session_id`, `prompt_id`).

**Edge case:** Late play in the archive creates the same single set, just flagged `late=true`. It still gets reused across groups.

### 7.2 Three prompts per day

Always exactly three. Two felt too thin (no day-shape). Four pushed the play time over 90 seconds, which broke the daily-ritual promise.

### 7.3 Daily set integrity

Once `total_players > 0` for the day, the daily set is locked. The Creator dashboard cannot regenerate or swap prompts. This is enforced at the database level via the `generate-daily-prompts` edge function.

**Why so strict:** Players form opinions about prompts the second they see them. Swapping a prompt mid-day would erode trust in the data.

### 7.4 Answer normalization

Pipeline (in `src/lib/normalize.ts`):
1. Trim whitespace.
2. Lowercase.
3. Collapse internal whitespace to single spaces.
4. Depluralize (rule-based, not stemmed — `cats → cat`, but `bass → bass`).
5. Apply admin-curated aliases (e.g. `nyc → new york`).
6. Apply fuzzy typo-merge if within Levenshtein distance 1 of an existing high-frequency answer.

The original raw answer is preserved in `raw_answer` for display in the player's own Results. Crowd-facing surfaces always show the normalised form.

### 7.5 Word freshness & lifecycle

Words in the bank carry a **lifecycle state** and a **last-used date**.

**Lifecycle states:** Draft → Active → Test → Downweighted → Disabled. Only Active and Test words can appear in a daily set, with Test words capped at one per day.

**Freshness penalty:** A word used in the last 14 days is heavily penalised by the generator. A word used in the last 30 days gets a moderate penalty. The intent is to keep daily sets feeling novel without exhausting the bank.

---

## 8. Social layer

### 8.1 Challenge a friend (`/c/:token`)

A one-shot, lightweight link. The sender plays, gets a shareable URL, the recipient plays the same daily set, and they land in head-to-head compare. No account, no friend-graph, no notifications.

**Persistence:** The link stays valid forever for that specific daily set. If a recipient opens it three months later, they can still play that day's prompts and see the comparison.

### 8.2 Recurring groups (`/g/:slug-suffix`)

Persistent named groups with stable invite URLs. Members join once and the group accumulates history. The slug suffix is a 6-character random ID to prevent guessing.

**Membership management:**
- Anyone with the link can join.
- Members can leave and rejoin at any time.
- Leaving preserves their historical answers (groups remember who jinxed with you in week 3 even after they leave).

### 8.3 Identity system

Players get a `display_name` stored in localStorage, displayed as a persistent pill in the top-right of the header. Changing it updates future answers but does not retroactively rewrite past ones.

**Why localStorage and not accounts:** Friction kills first-session conversion. We trade rigour (a wiped browser loses identity) for instant play.

### 8.4 Social memory layer

For each (viewer, other) pair, we track the running tally of how often their answers overlapped. Used to power the Pair page rivalry meter and the Group Members tab. Zero-overlap entries are filtered out of "Your pairs" surfaces but appear in the full Members list.

### 8.5 Pair page rivalry model

| Jinx rate (jinx / days together) | Label |
|---|---|
| ≥ 60% | **Twin** |
| 30–59% | **Sync** |
| 10–29% | **Wildcard** |
| < 10% | **Opposite** |
| < 2 days together | (no label) |

The blurbs are short, second-person, and warm. "You and Andy think alike on most days" beats "You match 67% of the time."

---

## 9. Creator dashboard philosophy

### 9.1 Curation hub structure

Five tabs, ordered by frequency of use:

1. **Overview** — at-a-glance: today's set, players, jinx rates, anomalies.
2. **Tuning** — sliders that bias the daily generator (category weighting, freshness aggressiveness, test-word frequency).
3. **Answers** — hygiene queue (suggested aliases, blocked terms, weird incoming answers).
4. **Insights** — drill-down: per-prompt history, per-word strength, AI-discovered missing words.
5. **Data** — CSV import/export of the word bank.

### 9.2 JINXability framework

Each word/pair carries a JINXability score — an AI-informed prediction of how reliably the prompt produces shared mental images. High JINXability ≠ high consensus; we want a *sweet spot* (~30–60% top-answer share). Too high = boring, too low = chaotic.

The "2-second instant feel" test: when an admin sees the prompt, do they have an answer within two seconds? If yes, it's probably JINXable.

### 9.3 Quality controls

- **Semantic lane protection** — prompts must combine words from different lanes (e.g. "object + emotion") to force creative bridging.
- **Active/test mixing** — Test words must be paired with Active anchors to avoid double-uncertainty.
- **Generation quality gates** — the generator re-runs if the produced trio fails category diversity, freshness, or JINXability thresholds.

### 9.4 Word strength scoring

A composite 0–100 score per word, driven by:
- Crowd convergence (how reliably it produces consensus).
- Freshness fatigue (how recently overused).
- Suggestion volume (do players keep typing it as an *answer*, suggesting it's a strong content word).
- Alias graph (how many other terms collapse onto it).

Scores bucket into **KEEP** (≥70), **WATCH** (40–69), **CUT** (<40). The board-game deck is curated from the KEEP bucket plus qualitative admin overrides.

---

## 10. Copy & voice

### 10.1 Tone

Warm, low-key, second-person. Slightly knowing. Never enthusiastic-for-the-sake-of-it.

- ✅ "Did you say the same thing as your mates?"
- ❌ "Get ready for daily JINX action! 🎉"

### 10.2 Microcopy conventions

| Surface | Copy |
|---|---|
| Jinx event (self in cluster) | "YOU JINXED" |
| Jinx event (others, viewer not in) | "JINX" |
| No-jinx prompt | "N unique answers · M played · no jinxes" |
| Empty group history | "No jinxes yet" |
| Lock state | "Play to reveal" |
| Late play tag | "Late" (small, muted) |
| Primary CTA | "Play today's JINX" |
| Secondary share | "Send to a friend" |

**Pluralisation:** Always real ("1 JINX", "2 JINXes"), never lazy ("1 JINX(es)"). The Creator dashboard linter flags any string with "(s)" in it.

### 10.3 Typography presentation rules

- **Answers are never truncated** — they always fully display, even if they wrap to two lines.
- **Group names may truncate** — but only recurring group names, because they're displayed in dense surfaces. Use middle-truncation if the name is long.
- **Prompt words are always uppercase** in display contexts, lowercase in data.

---

## 11. Decision log

A running list of choices made and the alternatives rejected, so we don't relitigate them.

### 11.1 Three-tab bottom nav (not four)

Considered Profile / Stats as a fourth tab three separate times (V4, V6, V7). Rejected each time because every prototype drifted toward a stats dashboard, violating principle 2.2.

### 11.2 Amber as the only celebratory color

Considered a secondary "good answer" green in V6. Cut because it diluted the amber jinx moment and made the palette feel generic.

### 11.3 No dark mode in player app

Player app is light-mode only. Tested a dark theme in V5; testers reported it felt "more serious" than the brand intends. The Creator dashboard is also light-mode-only, but for a different reason (data legibility).

### 11.4 No anonymous signups

Despite no account requirement, we explicitly do *not* use Supabase anonymous auth. Identity is `session_id` in localStorage. Anonymous auth would create a trail of throwaway DB rows and complicate RLS.

### 11.5 No streaks

Streaks were prototyped in V3. Removed because a broken streak creates loss aversion that conflicts with "Did you say the same thing as your mates?" framing — the answer to that question shouldn't be "no, and now my streak is gone."

### 11.6 No per-user accuracy %

Same reason as streaks. Also: accuracy frames the game as a test the player is taking, which contradicts principle 2.1.

### 11.7 Weekly recap is gated

A weekly recap email/screen was specced in Phase 6. It only ships if median jinxes-per-group-per-week is ≥ 3 — below that, the recap would feel sparse. Currently un-shipped.

### 11.8 Result-led group feed, not roster-led

Earlier group screens led with "who played today." Replaced with `GroupTodayFeed` (result-led) because non-jinx days looked empty when the roster was first.

### 11.9 Members tab replaces PairChipsRow

Horizontal scrolling chips broke at 5+ members. The Members tab gives full vertical visibility with rivalry context.

### 11.10 Daily set integrity is non-negotiable

Considered an admin override for "obviously broken" prompts. Rejected — the override would erode trust in the data more than any single bad prompt would.

---

## 12. Anti-patterns & guardrails

Things future-you might be tempted to add. Don't.

- **🚫 Global leaderboard** — violates principle 2.2.
- **🚫 Confetti / celebratory animations beyond amber chrome** — the amber *is* the celebration.
- **🚫 "Streak preserved" recovery flows** — re-entrenches the loss-aversion frame we rejected.
- **🚫 Push notifications for "X jinxed with you!"** — feels intrusive; the daily ritual is opt-in by definition.
- **🚫 Premium tier with extra prompts** — three prompts per day, full stop.
- **🚫 Comment threads on prompts** — moderation cost > social value.
- **🚫 Public groups / discovery** — small-circle premise is load-bearing.
- **🚫 Rewriting `src/integrations/supabase/client.ts` or `types.ts`** — they're auto-generated.
- **🚫 Foreign keys to `auth.users`** — use `session_id` in `profiles` if you ever need extra user data.
- **🚫 Storing roles on a profiles table** — privilege escalation risk; use the `user_roles` pattern.
- **🚫 CHECK constraints with time-based predicates** — Postgres requires immutable; use validation triggers instead.

---

## 13. Open questions & future considerations

Things we know we'll revisit.

- **Weekly recap (Phase 6)** — gated on engagement data, see §11.7.
- **Group nicknames per pair** — "running joke" labels you could attach to a pair. Adds delight but also moderation surface.
- **Cross-group jinx feed** — "you jinxed with 4 people today across 2 groups" — would be a nice digest but risks becoming a stats panel.
- **Internationalisation** — currently English-only. JINXability is heavily language-dependent; a French version would need its own word bank, not a translation.
- **Native app shell** — currently PWA. A native shell would unlock push and biometric identity, but at a maintenance cost we haven't justified yet.
- **Physical deck integration** — the board game deck and the digital word bank share a source of truth. Long-term, the dashboard should let admins "promote to deck" / "demote from deck" in one click.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **Daily set** | The three prompts active for one calendar day. |
| **Prompt** | A two-word pair, e.g. MISTAKE + RIVER. |
| **Answer** | A player's single-word response to a prompt. |
| **Normalised answer** | The canonical form of an answer after the pipeline in §7.4. |
| **Cluster** | A group of identical normalised answers for one prompt. |
| **Jinx** | A cluster of ≥ 2 members in a group (or friends in a challenge) sharing an answer. |
| **Pair** | A two-person relationship within a group. |
| **Recurring group** | A persistent named group with an invite link (`/g/:slug-suffix`). |
| **Challenge room** | A one-shot two-person comparison (`/c/:token`). |
| **Late play** | Playing a past day's set from the archive; excluded from official crowd consensus. |
| **JINXability** | An AI-informed score of how reliably a prompt produces shared mental images. |
| **Semantic lane** | A category bucket (object, emotion, place, etc.) used to enforce diverse prompt pairings. |
| **KEEP / WATCH / CUT** | Word strength buckets from the composite 0–100 score. |
| **Brag Block** | The screenshot-optimised summary card at the top of Results. |
| **V8** | The current visual theme; eighth iteration. |

---

*End of design reference. When in doubt, return to the north-star sentence: "Did you say the same thing as your mates?"*
