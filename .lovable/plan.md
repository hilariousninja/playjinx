## What’s going wrong

The latest attempt made the blank bar permanent because the app now locks `html`, `body`, and `#root` to `height: 100%` / `overflow: hidden` on mobile, while the shell uses `100dvh`. Firefox Android is unreliable when the address bar changes: its `dvh`/root-height calculation can leave the app shell shorter than the actual viewport, so the browser background shows below the bottom nav.

Chrome works because it updates dynamic viewport units and fixed/sticky positioning more consistently during address-bar show/hide. Firefox Android still has known rough edges there.

## Plan

1. **Undo the root scroll lock regression**
   - Remove the mobile-only `html, body, #root { height: 100%; overflow: hidden; }` rule.
   - Remove the mobile-only `.app-shell { height: 100dvh; overflow: hidden; }` lock.
   - This should stop the permanent blank strip immediately.

2. **Return to the safer document-scroll model**
   - Make `.app-shell` use `min-height: 100svh` first on mobile, with `100dvh` only where it helps.
   - Avoid making the middle content area the only scroll container globally, because that is what worsened Firefox behavior.

3. **Make the bottom nav cover Firefox’s exposed strip**
   - Change `MobileBottomNav` back to a viewport-attached bottom nav on mobile.
   - Give it a background “extension” below itself using a pseudo-element or oversized bottom inset so if Firefox exposes space during address-bar transitions, the exposed area is still the app background/nav background rather than a blank browser strip.
   - Keep normal safe-area padding.

4. **Restore page spacing for fixed nav**
   - Add a single reusable bottom spacer/padding rule to `.app-shell-main` / page content so content is not hidden behind the fixed nav.
   - Apply it consistently to the 7 mobile routes already using `app-shell`.

## Expected result

The nav goes back to the previous non-permanent behavior, then the Firefox-specific exposed area is visually masked by the nav/background extension instead of appearing as a blank bar when switching tabs or when the address bar reappears.