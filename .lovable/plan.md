Why Chrome works but Firefox Android does not:

Chrome Android handles `position: fixed`, `position: sticky`, `100dvh`, and `env(safe-area-inset-bottom)` more consistently when the address bar appears/disappears. Firefox Android still has rough edges around the dynamic address bar: the browser viewport, CSS viewport units, and sticky/fixed positioning can temporarily disagree when you change tabs or scroll upward to reveal the address bar. That exposes the browser/page background as a blank strip below the nav.

The current fix moved the nav away from `fixed`, but the page itself still scrolls on the browser viewport on several screens. That means Firefox is still allowed to resize/re-anchor the whole document when its address bar changes.

Plan:

1. Replace the current partial shell with a true mobile app shell
   - On mobile, make the root app shell exactly fill the visible viewport.
   - Prevent the document/body itself from being the main scroll container.
   - Keep desktop/tablet behavior unchanged.

2. Make page content the only scrollable area
   - Add/adjust `.app-shell-main` so it is `flex: 1`, `min-height: 0`, and `overflow-y: auto` on mobile.
   - Convert the bottom-nav pages so content scrolls inside this area instead of scrolling the whole browser page.

3. Make the bottom nav a normal shell footer
   - Remove `sticky` from `MobileBottomNav`.
   - Use `shrink-0` so it stays at the bottom of the app shell, not attached to Firefox’s shifting browser viewport.
   - Keep the safe-area padding.

4. Update the affected routes consistently
   - Play, Landing, Groups, Archive, Results, GroupToday, and GroupPair will use:

```text
.app-shell
  AppHeader
  .app-shell-main  ← only this scrolls
    page content
  MobileBottomNav  ← normal footer, not fixed/sticky
```

5. Remove the old workaround assumptions
   - No `visualViewport` JavaScript.
   - No Firefox-specific sticky override.
   - No page-level bottom padding hacks for a fixed nav.

Expected result:

The nav should stay flush with the visible bottom because Firefox will no longer be repositioning a fixed/sticky element against a changing browser viewport. When the address bar appears or disappears, only the shell height changes; the content area adjusts above the nav.

<presentation-actions>
<presentation-open-history>View History</presentation-open-history>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>