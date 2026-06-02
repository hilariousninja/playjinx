# Integrate stem-grouping into design docs

The normalization pipeline now has a fourth stage (morphological stem-bucketing) and the `AnswerStat` shape now exposes per-surface-form breakdowns. Update the three design tiers to reflect this, in proportion to each tier's depth.

## Tier 1 — `docs/jinx-design-tier1-philosophy.md`

One-line edit to the "Defining decisions" bullet (line 52) so the philosophy reflects that grouping is morphological, not just spelling-tolerant:

- Before: "Answer normalization (trim, case, depluralization, fuzzy typo merge) is automatic — players never feel punished for spelling."
- After: "Answer normalization (case, plurals, typos, and word forms like drive/driving/drove or happy/happiness) is automatic — players never feel punished for spelling or wording. Their own card always shows exactly what they typed."

## Tier 2 — `docs/jinx-design-tier2-comprehensive.md`

Update the Core mechanics summary bullet (line 118) to add stem-grouping and the display invariant:

- Before: "Normalization: trim, lowercase, depluralize, fuzzy-merge near-duplicates."
- After: "Normalization: trim, lowercase, depluralize, fuzzy-merge typos, then stem-bucket morphological variants (drive↔driving↔drove, happy↔happiness↔happily). Each player's card shows their raw input verbatim; only the cluster label uses the most-popular surface form."

## Tier 3 — `docs/jinx-design-tier3-exhaustive.md`

Full rewrite of §7.4 Answer normalization (lines 425–435). Replace 6-step pipeline with the current 4-stage pipeline + display contract + drawer transparency:

New section will document:

1. **Pipeline stages** (in order):
   - Stage 1 — `normalizeAnswer()`: trim, lowercase, strip non-alphanumeric except spaces, collapse whitespace, depluralize single-word inputs via a rule-based stripper with a `DEPLURAL_SKIP` list (tennis, analysis, gas, …).
   - Stage 2 — alias map: admin-curated explicit mappings (`nyc → new york`, `soccer → football`).
   - Stage 3 — fuzzy typo-merge: Levenshtein with conservative guards (≥7 chars, distance 1–2, count-ratio guard so a popular word can't be swallowed by a near-duplicate).
   - Stage 4 — **stem bucketing** (`stemAnswer()`): groups morphological variants under a shared cluster. Handles regular `-ing`/`-ed`/`-ness`/`-ly`/`-ity`/`-est`/`-er` with skip-lists per suffix, plus a ~80-entry irregular map for past-tense verbs (drove→drive, went→go, thought→think) and comparative adjectives (better→good, worst→bad). Multi-word answers are never stemmed (avoids mangling proper nouns).

2. **Display contract** — the inviolable rule:
   - Each player's `raw_answer` is shown verbatim on **their own** result card — "driving" stays "driving", "happiness" stays "happiness".
   - The cluster label (the bar inside results, the row in the drawer) uses the **most-popular surface form** within the cluster.
   - The AnswerDrawer surfaces the breakdown with a muted sub-line `also: happiness (3), happily (1)` when a cluster spans multiple surface forms, so the grouping is transparent, not magic.

3. **Data shape** — `AnswerStat` now carries optional `members: string[]` (every normalized input in the cluster) and `surfaceForms: Array<{form, count}>`. Consumers do `s.members?.includes(canon)` for stem-aware user→cluster lookup, falling back to Levenshtein for residual typos.

4. **What stays out of scope** — synonyms (car/auto) remain admin-curated via aliases; `-tion`/`-sion` derivations are deliberately not stemmed (motion, station, ocean false positives).

Add one line to the glossary (line 641) clarifying:

- **Cluster**: "A group of answers that share a stem or alias mapping for one prompt — variants are counted together, but each player still sees their own wording."

## Files touched

- `docs/jinx-design-tier1-philosophy.md` — 1 bullet
- `docs/jinx-design-tier2-comprehensive.md` — 1 bullet
- `docs/jinx-design-tier3-exhaustive.md` — §7.4 rewrite + glossary line

No code changes. No memory file changes (the `mem://technical/answer-normalization` entry was already updated in the previous turn).
