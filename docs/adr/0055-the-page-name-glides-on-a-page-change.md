# ADR 0055: The page's name glides across on a page change

- **Status:** Proposed by Azri. The shell is area 1's, so Richie accepts or declines it in review.
- **Date:** 2026-11-16
- **Story:** none; UI polish for the proposal demo

## Context

ADR 0054 (point 7) gives a page change one motion: the page region fades and settles alone, while the panel and the bar stand still. Azri designed a page transition, "Broadcast Wipe", as a stand-alone demo page: the page changes the moment you click, and a slanted band with stripes at both edges sweeps across with the new page's name, like the switch on a race broadcast. Nothing is delayed or covered. Going back to Home sweeps the other way. Azri asked for it in OrderPilot, and then, after seeing it on the Docker build, kept only its name.

## Decision

1. **The name joins the fade; it does not replace it.** The page region still fades as ADR 0054 says. The name is one more layer, `PageWipe` in `app/shell/`, with its styles in `styles/page-wipe.css`.
2. **The name and one stripe move.** The new page's name, or a record's number on a record page, glides across in large uppercase type in the product's teal (`--primary` at 45 %), led in by one slanted stripe, the demo band's leading edge: a teal stripe with a light line beside it, the full height of the screen. The band's trailing stripe and its tint are gone. Going Home or Back, the stripe leads on the left.
3. **It runs behind the content.** It sits above the aurora (the body's background) and below everything else, so it never passes over a word, takes a click or holds anything up.
4. **It rides in the strip every page leaves clear:** under the top bar and the record tabs, to the right of the page title, its top 128 px down and its middle 70 % across while it glides. In the middle of the screen the cards hid it.
5. **It follows the page key.** It plays when the path changes, the same rule that moves the page region, so a filter, a tab, a sort or the side peek never sets it off, and the first page opens without it.
6. **Home and Back glide the other way,** from right to left: the same glide played in reverse.
7. **One glide takes 850 ms,** as in the demo: in fast, a short glide past the title, out fast. A new page change during a glide starts a new one.
8. **Reduced motion, or a browser without the Web Animations API, shows nothing.** The page still changes at once.

## Alternatives considered

- **The demo's band behind the content, with the name in it.** Built first. Behind the cards the band showed mostly in the margins and through the glass. Azri asked for the diagonals to go and the text to stay, then for the leading stripe to come back.
- **The stripes over the content, the demo's second mode.** Built and seen: far easier to see, but Azri turned it down, because stripes crossing the words, even for under a second and without taking a click, get in the way of fast work.
- **The name in the middle of the screen, as in the demo.** The cards hid it.
- **Keep only the fade.** That is ADR 0054 as it stands; Azri asked for the transition.

## Consequences

- **It is longer than the motion rule's 150 to 250 ms for UI.** Nothing waits for it: the page has changed before the name arrives. It is movement across the screen, the kind CLAUDE.md gives springs rather than a time limit.
- **On a narrow window the title can reach the strip.** It was checked at 1440 px wide; the name sits behind the title there, never over it.
- **The end-to-end tests are unaffected:** Playwright runs with reduced motion (`playwright.config.ts`), so they see nothing.
- **It adds under a kilobyte to the entry bundle,** and the animation moves one element's transform only.
- If Richie declines it, removing it is one line in `AppShell.tsx`, the component, its test and the style file.
