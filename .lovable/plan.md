# Fix "Boul" + prevent future typos

## 1. One-off fix: Steph's answer (today, RICE + ANGER)

Update the single row directly:

- `answers.id` = `89b03cc3-aa12-482d-ab87-2c7c95743702`
- `raw_answer`: `Boul` → `Boil`
- `normalized_answer`: `boul` → `boil`

This re-buckets her into the "boil" cluster across Results / Group / Archive. The prompt's `unique_answers` count auto-updates via the existing `update_prompt_stats_on_answer` trigger (we'll fire it by touching the row).

## 2. Native browser spellcheck (zero infra)

In `src/pages/Play.tsx`, on the answer `<input>`:

- Add `spellCheck={true}` (currently the default-off behavior on many mobile keyboards; explicit is safer).
- Add `autoCorrect="on"` and `autoCapitalize="off"` so iOS/Android keyboards underline misspellings and offer corrections without auto-capitalizing the linking word.
- Keep `autoComplete="off"` to avoid form-history pollution.

That alone would have flagged "boul" with a red underline on Steph's keyboard.

## 3. Soft "Did you mean?" confirm before submit

A lightweight client-side check that runs only when the user hits Submit. No new tables, no server round-trip beyond what we already do.

### How it works
On submit, before calling `submitAnswer`:

1. Normalize the input → `candidate` (e.g. `boul`).
2. Skip the check entirely if `candidate` is ≤2 chars, multi-word, or already an exact match to a known answer for this prompt.
3. Fetch the top ~15 normalized answers for this `prompt_id` (one cheap query, cached per prompt for the session).
4. Find the best fuzzy match using existing `levenshtein()` with a STRICTER threshold than the post-hoc merger:
   - 4–5 char words: distance = 1, and target must have ≥5 submissions (so "boul" matches "boil" only once "boil" is established).
   - 6+ char words: distance ≤ 2.
   - Never suggest when `candidate` itself already has ≥3 submissions (don't second-guess a real word).
5. If a match is found, show an inline confirm UI directly under the input — no modal:
   > Did you mean **boil**? &nbsp; `[Yes, use boil]`  `[No, submit "boul"]`
6. "Yes" submits the suggested word (overwrites input). "No" submits raw as-is and remembers the dismissal for that prompt so we don't re-prompt.

### Why this is safe
- It's a suggestion, never an auto-correct. Player keeps full control (preserves the "you see your own raw input" contract).
- The "target must have ≥5 submissions" guard means we only suggest established crowd answers, not random other typos.
- Runs purely client-side using the stats we already fetch.

### Files touched
- `src/lib/normalize.ts` — add `suggestCorrection(candidate, popularAnswers): { suggestion, distance } | null`.
- `src/lib/store.ts` — add `getTopAnswersForPrompt(promptId, limit=15)` (returns `normalized_answer`s by frequency) with a session cache keyed by prompt id.
- `src/pages/Play.tsx` — wire `spellCheck`/`autoCorrect` on the input; in `handleSubmit`, if no suggestion-state yet, run `suggestCorrection`; if it returns a hit, set local state and render the inline confirm row instead of submitting.
- `src/test/stemmer.test.ts` (or a new `suggest.test.ts`) — add cases: `boul→boil`, `boat` (no suggestion when boat is itself popular), `xyz` (no suggestion when no close target), 7-char distance-2 case.

## 4. Out of scope (kept as-is)
- The post-hoc `fuzzyMergeGroups` thresholds — leaving the ≤6-char skip intact so we don't accidentally merge bake/bike retroactively.
- No new admin alias is added (per your choice). If "boul" recurs from others, Answer Hygiene workflow handles it.

## Technical notes
- Direct row update uses the data-update tool, not a migration.
- The Play page already passes input through `validateInput`; the new suggestion step slots in between validation and `submitAnswer`.
- The per-prompt top-answers fetch is cached in-memory only — no localStorage, no extra DB load beyond a single SELECT the first time a user submits for that prompt.
