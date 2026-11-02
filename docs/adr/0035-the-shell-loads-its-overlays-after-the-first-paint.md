# ADR 0035: The shell loads its menus, popover and sheet after the first paint

- **Status:** Accepted
- **Date:** 2026-11-02
- **Story:** P-78, room in the entry bundle (issue 178)

## Context

CLAUDE.md section 6 sets the initial JavaScript at 250 KB gzip or less. On 2 Nov `main` was at 248.8 KB, and prompt 004's next stories (module navigation, the list template, the record tabs) all add to the shell. The limit stays where it is, so the entry had to lose weight without any change a person can see.

Measured from the source maps, the entry held three things the first screen never uses:

- **The common barrel.** `AppShell` imported a skeleton and the `Toaster` from `@/components/common`, which brought every common component: the data table, its export and column menus, the demo badge and their icons (about 12 KB).
- **The tooltip.** `AppShell` wrapped every page in `TooltipProvider`, which brought Radix's popper and Floating UI, though no tooltip shows in the shell (about 5 KB with what it shared).
- **The overlays.** The role switcher, the theme menu and the user menu (Radix dropdown menu), the bell (Radix popover) and the narrow-screen menu (Radix dialog, as a sheet) open only on a click, yet Radix's menu, popper, focus scope, dismissable layer and scroll lock sat in the entry (about 30 KB).

## Decision

1. **Direct imports in the entry.** The shell imports `@/components/common/skeletons` and `@/components/common/Toaster`, never the barrel.
2. **Each tooltip brings its own provider,** as shadcn's current tooltip does, so the shell needs no `TooltipProvider`. The delay is unchanged (0 ms).
3. **Facades for the shell's overlays.** `apps/web/src/app/shell/overlays/` has `dropdown-menu.tsx`, `popover.tsx` and `sheet.tsx`, with the same component names and props as `@/components/ui/*`. Until the real module arrives, the root renders its children, the content renders nothing, and the trigger is a plain button with the same element, classes and `aria-haspopup`, `aria-expanded="false"` and `data-state="closed"` that Radix sets. The real module is fetched once the browser is idle (`requestIdleCallback`, or a 200 ms timer in Safari), or sooner on hover or focus. A click before it arrives opens the popup as soon as it does, and focus moves to the real trigger if the stand-in had it.
4. **The palette and the session-ended dialog are prefetched on idle** from `AppShell`. They were already lazy; now Control K and an ended session do not wait for the network.
5. **The rule is kept by tools, not memory.** The `orderpilot-web/entry-chunk` lint rule stops the entry's files importing the barrel, the generated client or a Radix overlay, and `pnpm budget` prints the five largest modules in the entry, and the five largest of our own code, from a module report the build writes to Vite's cache folder.

The entry went from 248.8 KB to 202.0 KB gzip.

## Consequences

- The stand-in is replaced by the real trigger shortly after the first paint. The element is new, so a test that holds an element handle across that moment must look the trigger up again. Locators and role queries do this already.
- A test that renders the app through `src/test/render.tsx` loads the overlays first, so it sees what a person sees after the prefetch, and other test files do not pay for Radix. `overlays/deferred.test.tsx` covers the moment before.
- A shell overlay must come from a facade. A part the facades do not have yet (such as a submenu) is added to the facade with one `deferredPart` line.
- Pages are already lazy chunks, so they keep importing `@/components/ui/*` directly.

## Alternatives considered

- **Lazy-load whole widgets with a look-alike fallback.** This needs no facade, but a click on the fallback is lost, and every widget would have a second copy of its trigger to keep in step.
- **Lazy-load the whole shell for signed-in people.** It saves less (the sidebar's icons and the router are needed anyway) and adds a wait between the splash and the shell.
- **`sideEffects: false` in the web app's `package.json`.** It would let the bundler drop unused barrel exports everywhere, but a wrong guess about a module with side effects (the zod set-up, i18n, the styles) breaks the app silently.
- **Raise the limit.** The story rules it out.
