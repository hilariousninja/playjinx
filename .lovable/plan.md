## Plan

1. **Remove the failed Firefox-specific nav workaround**
   - Remove the `@supports (-moz-appearance: none)` sticky override added in `src/index.css`.
   - Keep `MobileBottomNav` simple, with no visualViewport offset math and no browser-specific transform hacks.

2. **Create a real mobile app-shell layout**
   - Add reusable semantic CSS classes in `src/index.css` for:
     - a mobile page shell that uses `100svh`/`100dvh` viewport sizing instead of `min-h-screen`/`100vh`
     - a scrollable content area above the nav
     - a stable bottom nav slot that lives inside the shell instead of being positioned against Firefox’s browser viewport
   - This avoids Firefox Android’s dynamic address-bar bug where `fixed bottom-0` can attach to the wrong viewport when the toolbar appears/disappears.

3. **Convert the bottom-nav pages to the shell pattern**
   - Update the pages that render `MobileBottomNav` so their structure becomes:

```text
mobile app shell
  header
  scrollable page content
  bottom nav
```

   - Apply this to the main mobile routes: Landing, Play, Groups, Archive, Results, GroupToday, and GroupPair.
   - Remove the page-level `pb-20` spacer that was only compensating for a fixed nav.

4. **Keep desktop/tablet behavior unchanged**
   - The shell classes will be mobile-only where needed, and existing `md:` layout behavior remains intact.
   - Dashboard and non-bottom-nav routes are not touched.

5. **Verify the failure scenario**
   - Check the edited structure for route changes between bottom tabs.
   - Confirm the nav is no longer tied to `position: fixed` on Firefox Android, so scrolling upward to reveal the address bar should not create a grey/blank area underneath it.