

# V8 Faithful Implementation

## Summary
Recreate the v8 HTML reference inside the existing React/Tailwind app. Amber primary, 3-on-1 Play screen, brag-first Results page, day-card Archive with slide-in drawers, truthful Groups states. All backend logic stays unchanged.

## Implementation Order

### 1. Color System (`src/index.css`)
- Primary → amber (`#D97706`). Blue kept only in logo accent stroke.
- Background → warm cream (`#F6F4EF`)
- Match tier colors realigned with amber
- Keep Space Grotesk (already body font) — no font churn. Keep JetBrains Mono only where it already serves as monospace accent.

### 2. Logo (`src/components/JinxLogo.tsx`)
- Replace dot-line-spark with v8 two-stroke crossing mark (amber `\` over blue `/`)
- Wordmark: "JIN" dark + inline SVG "X"

### 3. Navigation
- **AppHeader**: Logo left, profile pill right. Desktop nav amber active.
- **MobileBottomNav**: 3 tabs, amber active state.
- **PlayerIdentity**: Gradient avatar pill.

### 4. Landing (`src/pages/Landing.tsx`)
- Faithful v8 layout: label → JINX title → tagline → callout → example card → amber CTA → how-it-works grid → timer
- Remove auto-redirect and GroupsList

### 5. Play (`src/pages/Play.tsx`) — Major refactor
- All 3 prompts on one screen. Remove carousel/pager.
- 3 stacked cards with active/done/inactive states (no left-border system — warm and game-like)
- Done cards: settled and readable, not overly dimmed
- Natural mobile input flow (Enter advances, no aggressive auto-focus)
- "See my results →" CTA → navigates to `/results`

### 6. Results (`src/pages/Results.tsx`) — New page + components
- **BragBlock** (`BragBlock.tsx`): dark card, vibe, headline, best hit pill
- Summary stats row
- Per-prompt answer cards with rank, bar, "See all answers →"
- **AnswerDrawer** (`AnswerDrawer.tsx`): slide-in ranked list + long-tail chips
- Bottom hierarchy exactly: "Share your results" primary → "Challenge a friend →" secondary text → countdown. No Archive CTA.

### 7. SlidePanel (`src/components/SlidePanel.tsx`) — New
- Full-screen slide-in, back button, CSS translateX, stackable z-index

### 8. Archive (`src/pages/Archive.tsx`) — Restructure
- Browse-only day-card feed (remove all input logic)
- Day cards → day detail (SlidePanel) → nested answer drawer
- Full hierarchy preserved: Archive → day card → day detail → answer spread

### 9. Groups (`src/pages/Groups.tsx`) — Restyle
- Truthful states using available data only:
  - Activity: "X played today" / "Waiting for X more" / "Nobody's played today" / solo invite
  - No fake streaks, matches, or per-member pills
- Avatar circle with gradient + initial

### 10. Routing (`src/App.tsx`)
- Add `/results` route
- Remove `/results` → `/archive` redirect

## Data Model Gaps (flagged)
1. Group match detection ("You both said X") — requires per-member answer data not available. Using aggregate states.
2. Group streaks — not tracked. Omitted.
3. Per-member play status pills — only aggregate count available. Showing "X of Y played."

## Files
- **New**: Results.tsx, SlidePanel.tsx, BragBlock.tsx, AnswerDrawer.tsx
- **Rewrite**: Play.tsx, Archive.tsx, Landing.tsx
- **Restyle**: Groups.tsx, JinxLogo.tsx, AppHeader.tsx, MobileBottomNav.tsx, PlayerIdentity.tsx, PromptPair.tsx
- **Foundation**: index.css, App.tsx

