## Problem

In the group "Today" view, Andy's answer for ARM + GRASS shows as `tenni` instead of `tennis`. Same in the crowd-results sheet.

## Root cause

`src/lib/normalize.ts` → `depluralize()` strips a trailing `s` from any word longer than 3 chars unless it ends in `ss` or `us`. `tennis` (6 chars, ends in `is`) slips through and becomes `tenni`. The same bug would mangle other false-plural `-is`/`-os` words (analysis, oasis, basis, chaos, kudos, ethos…).

## Fix

In `depluralize()`, extend the final-`s` guard to also skip words ending in `is` and `os`:

```ts
} else if (
  word.endsWith('s') &&
  !word.endsWith('ss') &&
  !word.endsWith('us') &&
  !word.endsWith('is') &&
  !word.endsWith('os') &&
  word.length > 3
) {
  return word.slice(0, -1);
}
```

Also add `tennis` explicitly to `DEPLURAL_SKIP` as belt-and-braces (cheap, future-proofs against rule churn).

That's it — single-file change in `src/lib/normalize.ts`. No data migration needed; normalization runs at display time, so Andy's answer will re-render as `tennis` on next load.