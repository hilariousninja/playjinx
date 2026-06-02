# Group similar answers by word stem

Today "drive" and "driving" are counted as two separate answers — and so are "happy" and "happiness". Add a light, conservative stemmer so morphological variants cluster together — **without changing what any individual player sees written on screen**.

## Display vs grouping (the key principle)

Two different layers, kept independent:

- **What each player sees** = their own `raw_answer`, exactly as typed. "wrote" stays "wrote", "happiness" stays "happiness". This is already how the app works (`r.answer.raw_answer` in `Results.tsx`).
- **How answers are grouped & counted** = a new `stem_key` derived from the normalized form. All variants pointing to the same stem share a count, a rank, and a percentage.
- **Cluster display label** (the bar inside each result row, and the drawer list) = the most popular surface form within the cluster (already how `getCanonicalAnswer` picks a winner — we just feed it a bigger cluster).

Net effect: if 4 people wrote "happy", 3 wrote "happiness", 1 wrote "happily":
- The cluster shows as **"happy" · 8 players · #1**
- Your own answer card still reads **"happiness"** (or whatever you typed), with a "you" pill
- The drawer breakdown shows the cluster, with an "also: happiness (3), happily (1)" sub-line.

## Scope

Single file core: `src/lib/normalize.ts`. No new dependencies. No DB migration. No edge function changes. No UI restructuring — `Results.tsx`, `AnswerDrawer.tsx`, etc. benefit automatically because they already consume `userCanonical` / `stats` from the grouping layer.

## Changes

### 1. New `stemWord(word)` function

Runs after `depluralize` inside a new `stemAnswer(normalized)`, single-word answers only (skip multi-word like "ice cream").

Conservative suffix stripping with guards, applied in order:

**Verb forms**
- **`-ing`** → strip, then handle doubled consonants (running → run) and silent-e restoration (baking → bake, writing → write)
- **`-ed`** → strip, then doubled-consonant + silent-e (baked → bake, stopped → stop)

**Noun/adjective derivations** (NEW per user request)
- **`-ness`** → strip (happiness → happy, sadness → sad, kindness → kind); restore `y` if base ended in `i` (happiness → happi → happy)
- **`-ly`** → strip if length permits (happily → happi → happy, quickly → quick, sadly → sad); skip-list for ly-words that aren't adverbs (only, holy, ugly, silly, jolly, family, reply, supply, apply…)
- **`-ity`** / **`-ities`** → strip + restore (creativity → creative, ability → able, simplicity → simple). Conservative: only when base ≥4 chars and result matches a recognised ending.
- **`-er`** / **`-est`** (comparatives) → strip with doubled-consonant + silent-e + y-restoration (happier → happy, bigger → big, nicer → nice, biggest → big); skip-list (water, paper, sister, mother, father, winter, summer, finger, better, never, every, very, where, here, there, were, after, under, over, river, dinner, letter, computer…)
- **`-tion`** / **`-sion`** → leave alone for v1 (too risky: motion, station, ocean aren't derivations). Revisit if needed.

**Guards across all suffixes**
- Minimum stem length 3 after stripping
- Length floor: don't stem words shorter than 5 chars (avoids sing→s, bed→b, ply→p)
- Hard skip-list for known false-positive roots
- Only one suffix stripped per pass (avoids cascading mangles)

### 2. Small irregular map (~80 entries)

A `IRREGULAR_FORMS: Record<string, string>` mapping that runs **before** suffix stripping. Mostly past-tense verbs, plus common adjective irregulars:

```
drove → drive,   driven → drive
ran → run
wrote → write,   written → write
swam → swim,     swum → swim
ate → eat,       eaten → eat
saw → see,       seen → see
went → go,       gone → go
took → take,     taken → take
came → come
flew → fly,      flown → fly
better → good,   best → good
worse → bad,     worst → bad
…
```

### 3. Two-tier normalization output

```ts
normalizeAnswer(raw) → string   // unchanged: comparison-safe surface form
stemAnswer(normalized) → string // NEW: aggressive root form for grouping
```

Where grouping currently keys on `normalized_answer`, it keys on `stem_key = stemAnswer(normalized_answer)`. The user's own answer record continues to carry `raw_answer` (display) and `normalized_answer` (alias lookup), unchanged.

### 4. Wire stems through the stats layer

In `src/lib/store.ts` (the `getStats` / `getCanonicalAnswer` path) and `fuzzyMergeGroups`:

- Bucket counts by `stem_key`
- Within each bucket, pick the highest-count surface form as the display label (already the pattern)
- `getCanonicalAnswer(myNormalized)` returns the bucket's display label, so the colored bar inside a player's result row reads "happy" when they wrote "happiness" — but the **top line of the card still shows their raw "happiness"**.

### 5. Fuzzy + alias layers unchanged

- Aliases still run on `normalized_answer` (so admin-curated NYC→New York keeps working)
- Levenshtein fuzzy still runs as a final pass on stems (catches typos)

## Files touched

- `src/lib/normalize.ts` — add `stemWord`, `IRREGULAR_FORMS`, `stemAnswer`, skip-lists per suffix
- `src/lib/store.ts` — key stats aggregation on stem, keep canonical-label selection
- `src/test/` — focused unit test file for stemmer covering:
  - Regulars: driving/drove/driven → drive; happiness/happily/happier → happy; running/runner → run
  - Skip-list: string, king, bring, only, holy, water, sister, family stay intact
  - Irregulars: wrote → write, went → go, best → good
  - Edge cases: short words untouched, multi-word untouched, plurals still work

## AnswerDrawer detail

When a cluster contains multiple surface forms (happy 4 / happiness 3 / happily 1), the drawer row shows:

- Canonical label as the bar: **happy · 8**
- Muted sub-line when cluster has >1 surface form: `also: happiness (3), happily (1)`

This keeps the grouping legible and auditable instead of hiding it.

## Risks & mitigations

- **Over-stemming false merges** (string→str, only→on, water→wat): hard per-suffix skip-lists + 5-char floor + recognised-suffix gating
- **Stemming proper nouns** (Reading the city → Read, Harry → Harr): proper-noun detection out of scope; admin aliases handle edge cases
- **Aggressive `-ity`/`-ness` chains** (creativity → creative, then creative → ?): single-pass only — no cascading stripping
- **Existing aliases**: aliases run on the normalized layer (pre-stem) so they remain authoritative
- **Historical data**: stats recompute live from `normalized_answer` rows, so older days re-group on next view. No backfill needed.

## Out of scope

- Synonym grouping (car/auto/vehicle) — stays admin-curated via aliases
- Cross-language stemming
- `-tion` / `-sion` noun derivations (too many false positives — motion, ocean, station)
- Showing other players' raw spellings on the main results card (only the cluster label changes there)
