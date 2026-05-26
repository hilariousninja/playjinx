## Root-cause analysis

This is not a normal content/layout bug. It is a mobile browser viewport bug made worse by the current app shell structure.

### Why Chrome works but Firefox Android does not

Chrome Android updates `position: fixed`, safe-area insets, and dynamic viewport units more consistently when the address bar hides/shows. Firefox Android is much more likely to expose the browser canvas when the visual viewport changes during upward scroll or route/tab changes.

So code that looks fine in Chrome can still show a blank strip in Firefox if the page mixes:
- a viewport-attached bottom nav,
- `vh` / `svh` / `dvh` shell sizing,
- internal scroll containers,
- route transitions that change document height,
- and body/document background that is not guaranteed to paint the exposed area.

### What is currently wrong in this project

1. **The current fix masks the symptom instead of removing the cause**
   - `MobileBottomNav` is `fixed bottom-0`.
   - It also has a huge `after:h-40` pseudo-element below it.
   - On Firefox Android, that pseudo-element can become part of the permanent painted region during viewport recalculation, which explains why the blank/bar issue became permanent instead of transient.

2. **The app shell still uses viewport-height sizing**
   - `.app-shell` uses `min-height: 100vh` and `min-height: 100svh`.
   - Firefox Android can disagree about what those units mean while the address bar is visible vs hidden.
   - Earlier forms/projects likely used simpler `min-h-screen` document scrolling without a custom fixed nav/shell combo, so Firefox had nothing complicated to reconcile.

3. **Different routes use different scroll models**
   - Landing uses `main.flex-1.overflow-y-auto`.
   - Play/Groups/Archive/Results use normal flex content.
   - Some challenge/group routes still use `min-h-screen` instead of `.app-shell`.
   - This inconsistency means switching bottom nav tabs changes the scroll container and page height model, which matches your report that it appears when changing tabs.

4. **The fixed nav and shell padding are double-managing bottom space**
   - `.app-shell` reserves bottom padding for the fixed nav.
   - The nav itself also uses safe-area padding.
   - The pseudo-element adds even more painted area below the nav.
   - In Firefox Android, this combination is especially fragile when the URL bar reappears.

5. **The page background is not applied at the true root level**
   - `body` has the background, but `html` / `#root` are not explicitly painted.
   - If Firefox exposes area outside the currently calculated app shell, that area can render as browser/default background rather than the app background.

## Proposed fix

### 1. Revert the risky Firefox mask

Remove the `after:h-40` bottom extension from `MobileBottomNav`. It was intended to hide transient exposure, but it can create or preserve the visible strip in Firefox.

### 2. Stop relying on viewport-height app shell sizing for mobile

Change `.app-shell` to use natural document layout instead of `100vh` / `100svh` on mobile.

The mobile shell should be:
- normal document flow,
- `min-height: 100%` rather than viewport units,
- no root scroll lock,
- no forced internal scroll container.

### 3. Paint the real root background

Set `html`, `body`, and `#root` to `background: hsl(var(--background))` so any exposed browser/layout area is visually indistinguishable from the app.

This addresses the core Firefox symptom even if the browser temporarily exposes a strip during URL-bar transitions.

### 4. Use one consistent mobile route shell

Create a consistent CSS rule for `.app-shell-main` or apply a consistent main wrapper pattern across mobile nav routes:

- header: normal flow, 52px
- content: normal document scroll
- bottom nav: fixed only on mobile
- content bottom padding: enough for nav + safe-area

Then update the affected routes to use that same content wrapper instead of a mix of `overflow-y-auto`, plain `flex-1`, and route-specific padding.

### 5. Keep the bottom nav fixed, but simple

Use a simple fixed bottom nav:

```text
position: fixed;
bottom: 0;
left/right: 0;
height: 56px + safe area padding;
background: app background;
```

No pseudo-element. No oversized below-nav area. No viewport unit dependency.

## Files to change

- `src/index.css`
  - remove mobile viewport-height shell sizing dependency
  - remove shell-level fixed-nav padding if moved to main wrappers
  - paint `html`, `body`, `#root`
  - add one reusable mobile bottom-nav spacing rule

- `src/components/MobileBottomNav.tsx`
  - remove the `after:*` mask
  - keep fixed mobile nav simple and deterministic

- Mobile routes using the bottom nav:
  - `src/pages/Landing.tsx`
  - `src/pages/Play.tsx`
  - `src/pages/Groups.tsx`
  - `src/pages/Archive.tsx`
  - `src/pages/Results.tsx`
  - `src/pages/GroupToday.tsx`
  - `src/pages/GroupPair.tsx`

These should all use the same document-scroll content spacing model.

## Validation

After implementation, test specifically:
- Firefox Android behavior after changing bottom nav tabs
- scrolling upward until the address bar becomes visible again
- short pages like Landing/Groups empty state
- long pages like Archive/Results

Expected result: no permanent strip, and any transient browser viewport exposure is painted with the same app background rather than a blank bar.