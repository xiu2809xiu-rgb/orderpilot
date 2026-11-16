# ADR 0055: A broadcast wipe on a page change

- **Status:** Proposed by Azri. The shell is area 1's, so Richie accepts or declines it in review.
- **Date:** 2026-11-16
- **Story:** none; UI polish for the proposal demo

## Context

ADR 0054 (point 7) gives a page change one motion: the page region fades and settles alone, while the panel and the bar stand still. Azri designed a page transition, "Broadcast Wipe", as a stand-alone demo page: the page changes the moment you click, and a slanted band with stripes at both edges sweeps across, like the switch on a race broadcast. Nothing is delayed or covered, and clicks and typing work throughout. Going back to Home sweeps the other way. Azri asked for it in OrderPilot.

The demo runs the band behind the content, so it shows wherever the page background does. It also offers a second mode, "stripes over the content", for layouts with little visible background.

## Decision

1. **The wipe joins the fade; it does not replace it.** The page region still fades as ADR 0054 says. The wipe is one more layer, `PageWipe` in `app/shell/`, with its styles in `styles/page-wipe.css`.
2. **The stripes run over the content.** OrderPilot's pages are almost all cards, and a band behind them showed only in the margins. As the demo's own second mode, only the two thin stripes and their light lines cross, with no fill and no page name. They sit above the page (z-index 40, where nothing in a page goes past 10) and below every dialog and toast (50), and they never take a click.
3. **It follows the page key.** It plays when the path changes, the same rule that moves the page region, so a filter, a tab, a sort or the side peek never sets it off, and the first page opens without it.
4. **Home and Back sweep the other way,** from right to left.
5. **One pass takes 850 ms,** as in the demo: in fast, a short glide, out fast. A new page change during a sweep starts a new one.
6. **Reduced motion, or a browser without the Web Animations API, shows no stripes.** The page still changes at once.
7. **Its colours are tokens:** the stripes are `--primary`, and the light lines mix `--primary` with white, so they follow the theme.

## Alternatives considered

- **The band behind the content, the demo's default.** Tried first: on the Docker build it showed only as a faint tint in the margins and a sliver of the page name, because the cards cover almost all of the background.
- **A band over the content with its fill and the page name.** Rejected: the fill and the name would sit over the words for most of a second.
- **Keep only the fade.** That is ADR 0054 as it stands; Azri asked for the wipe.

## Consequences

- **It is longer than the motion rule's 150 to 250 ms for UI.** Nothing waits for it: the page has changed before the stripes arrive. It is spatial movement across the screen, the kind CLAUDE.md gives springs rather than a time limit.
- **The stripes pass over the content for under a second on each page change.** They never take a click, and a test in the browser clicked a link beneath them.
- **The end-to-end tests are unaffected:** Playwright runs with reduced motion (`playwright.config.ts`), so they see no stripes.
- **It adds a few hundred bytes to the entry bundle,** and the animation moves one element's transform only.
- If Richie declines it, removing it is one line in `AppShell.tsx`, the component, its test and the style file.
