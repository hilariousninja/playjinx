# Fix: Blank strip below bottom nav on Firefox Android

## The problem

On Firefox for Android, a cream-colored strip (~nav height) appears between the in-app bottom nav (Play / Groups / Archive) and the system gesture bar. Chrome on Android renders the nav flush against the gesture bar. Visible in the attached video.

## Root cause

`src/components/MobileBottomNav.tsx` positions the nav with `position: fixed; bottom: 0`. On Firefox Android, fixed elements are anchored to the **layout viewport**, not the **visual viewport**. When the URL bar collapses on scroll, the visual viewport grows downward but `bottom: 0` stays pinned to the original layout-viewport bottom — leaving a strip of `<body>` background visible beneath the nav.

This is a long-standing Firefox-mobile behavior (Bugzilla 1737918 / 1724353). Chrome resizes the visual viewport in sync, so it doesn't show.

## Fix

Two small, surgical changes — both presentation-layer, no logic changes:

### 1. `src/components/MobileBottomNav.tsx`

Add a full-width background "extender" that paints the area beneath the nav with `bg-background`, so any Firefox phantom strip blends into the nav instead of revealing the page body.

- Wrap the existing `<nav>` so a sibling `<div aria-hidden>` sits behind it with:
  - `fixed left-0 right-0 bottom-0`
  - height taller than the nav (e.g. `h-32`) so it covers the gesture-bar inset even after URL-bar collapse
  - `bg-background` matching the nav
  - `z-40` (one below the nav's `z-50`) and `pointer-events-none`
  - `md:hidden`
- Keep the nav itself unchanged (still `z-50`, `pb-[env(safe-area-inset-bottom)]`, `h-14`).

### 2. `index.html`

Add `viewport-fit=cover` to the viewport meta so `env(safe-area-inset-bottom)` returns the correct value on devices with home-indicator gesture areas (currently it's 0 because the meta omits this). This makes the existing `pb-[env(safe-area-inset-bottom)]` actually do its job and reduces the gap on iOS Safari too.

- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`

## Why this approach

- Doesn't touch any business logic, routing, or nav structure.
- Pure-paint fix: the extender is invisible on Chrome (sits behind the nav, same color as body) and only becomes visible on Firefox when it leaves a strip — at which point it correctly matches the nav background.
- `viewport-fit=cover` is the standard fix for safe-area handling; pairs naturally with the existing `pb-[env(safe-area-inset-bottom)]`.

## Files changed

- `src/components/MobileBottomNav.tsx` — add background-extender sibling div
- `index.html` — append `viewport-fit=cover` to viewport meta

## Verification

- Open `playjinx.com/results` (or any page that shows the bottom nav) on Firefox Android, scroll to collapse URL bar, confirm no cream strip below nav.
- Re-check on Chrome Android and desktop — nav should look identical to today.
