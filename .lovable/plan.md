# JINX Design Reference Document

A single exhaustive markdown reference covering philosophy, every screen, every decision, and rejected paths — for future-you to stay aligned.

## Location

`docs/design-reference.md` (new `docs/` folder). Markdown, versioned with the code.

## Structure

```text
1.  Mission & North Star
2.  Design Philosophy
      2.1  Crowd prediction, not puzzle-solving
      2.2  Social payoff over stats
      2.3  Honesty over hype
      2.4  Mobile-first, thumb-first
3.  Audience & Use Cases
4.  Visual Identity (V8)
      4.1  Color system — Amber #D97706, Cream #F6F4EF, semantic tokens
      4.2  Typography — Space Grotesk, sizing scale, never-truncate rule
      4.3  Spacing, radii, shadows
      4.4  Iconography & motion principles
5.  Information Architecture
      5.1  Three modes: Play / Groups / Archive
      5.2  Bottom nav + 52px header
      5.3  Navigation layers (SlidePanel, vaul drawer, z-index)
6.  Screen-by-screen reference (purpose, layout, decisions, rejected alts)
      Landing, Play, Results, Archive, Groups Hub, Group Today,
      Group Members, Group History, Group Pair, Challenge Landing,
      Challenge Compare, Creator Dashboard (5 tabs)
7.  Core Game Mechanics
      7.1  One answer per day policy
      7.2  Three prompts per day
      7.3  Daily set integrity safeguard
      7.4  Answer normalization & fuzzy merging
      7.5  Word freshness & lifecycle
8.  Social Layer
      8.1  Challenge a friend (/c/:token)
      8.2  Recurring groups (/g/:slug)
      8.3  Identity system (localStorage display name)
      8.4  Social memory layer
      8.5  Pair page rivalry model
9.  Creator Dashboard Philosophy
      9.1  Curation hub structure
      9.2  JINXability framework
      9.3  Quality controls (tuning, hygiene, governance)
      9.4  Word strength scoring
10. Copy & Voice
      10.1  Tone of voice
      10.2  Microcopy conventions (no jinxes, you jinxed, etc.)
      10.3  Pluralization & truncation rules
11. Decision Log (why these, why not those)
      Rejected: dark mode for players, per-user stats dashboards,
      anonymous signups, weekly recap (gated), and others
12. Anti-patterns & Guardrails
13. Open Questions & Future Considerations
14. Glossary
```

## Sources

Distilled from `mem://` index entries, current code (theme tokens, screen components, lib helpers), and prior decisions captured in chat. No new design choices — purely documents what exists and why.

## Length

Aiming ~50–80 KB markdown (the "exhaustive bible" tier). Long-form prose where rationale matters, tight bullet/table format for tokens and conventions.
