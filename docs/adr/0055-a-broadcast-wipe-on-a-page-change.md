# ADR 0055: A broadcast wipe on a page change

- **Status:** Proposed by Azri. The shell is area 1's, so Richie accepts or declines it in review.
- **Date:** 2026-11-16
- **Story:** none; UI polish for the proposal demo

## Context

ADR 0054 (point 7) gives a page change one motion: the page region fades and settles alone, while the panel and the bar stand still. Azri designed a page transition, "Broadcast Wipe", as a stand-alone demo page: the page changes the moment you click, and a slanted band with stripes at both edges sweeps across, like the switch on a race broadcast. Nothing is delayed or covered, and clicks and typing work throughout. Going back to Home sweeps the other way. Azri asked for it in OrderPilot.

The demo runs the band behind the content, so it shows wherever the page background does. It also offers a second mode, "stripes over the content", for layouts with little visible background.

## Decision

1. **The wipe joins the fade; it does not replace it.** The page region still fades as ADR 0054 says. The wipe is one more layer, `PageWipe` in `app/shell/`, with its styles in `styles/page-wipe.css`.
2. **The band runs behind the content, as in the demo.** It sits above the aurora (the body's background) and below everything else, so it shows between the cards, through the glass panel and top bar, and behind the page title, and never passes over a word or takes a click. It carries the new page's name, or a record's number, as a faint watermark. Azri chose this over the stripes-over mode so a page change never gets in the way of work.
3. **It follows the page key.** It plays when the path changes, the same rule that moves the page region, so a filter, a tab, a sort or the side peek never sets it off, and the first page opens without it.
4. **Home and Back sweep the other way,** from right to left.
5. **One pass takes 850 ms,** as in the demo: in fast, a short glide, out fast. A new page change during a sweep starts a new one.
6. **Reduced motion, or a browser without the Web Animations API, shows no stripes.** The page still changes at once.
7. **Its colours are tokens:** the stripes are `--primary`, and the light lines mix `--primary` with white, so they follow the theme.

## Alternatives considered

- **The stripes over the content, the demo's second mode.** Built and seen on the Docker build: far easier to see, because the cards cover most of the background. Azri turned it down on 16 Nov, because stripes crossing the words, even for under a second and without taking a click, get in the way of fast work.
- **A band over the content with its fill and the page name.** Rejected: the fill and the name would sit over the words for most of a second.
- **Keep only the fade.** That is ADR 0054 as it stands; Azri asked for the wipe.

## Consequences

- **It is longer than the motion rule's 150 to 250 ms for UI.** Nothing waits for it: the page has changed before the stripes arrive. It is spatial movement across the screen, the kind CLAUDE.md gives springs rather than a time limit.
- **Behind the cards, the band shows mostly in the margins,** the gaps, the glass and the title area, so it is subtle on a busy page. For a moment, an aqua stripe behind the title's aqua lettering makes those letters hard to see; the text is never covered.
- **The end-to-end tests are unaffected:** Playwright runs with reduced motion (`playwright.config.ts`), so they see no stripes.
- **It adds about a kilobyte to the entry bundle,** and the animation moves one element's transform only.
- If Richie declines it, removing it is one line in `AppShell.tsx`, the component, its test and the style file.
