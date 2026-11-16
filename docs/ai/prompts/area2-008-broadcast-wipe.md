# Area 2, prompt 008: the broadcast wipe on a page change

No story owns this: it is UI polish for the proposal demo. Azri's prompts are quoted as typed, and the rest is summarised. The decision is ADR 0055.

## 1. The request

```text
can you access the most recent claude artifact i made
```

```text
okay please use that broadcast wipe animation in this application when switching from one page to another.
```

The artifact was Azri's "Broadcast Wipe" demo: a page changes the moment you click, and a slanted band with a stripe and a light line at each edge sweeps across in 850 ms, like the switch on a race broadcast. Going back to Home sweeps the other way, and reduced motion turns it off. The AI read its page and its two files, `page-wipe.css` and `page-wipe.js`.

## 2. What the AI built

`PageWipe` in `app/shell/` plays the sweep with the Web Animations API whenever the shell's page key changes, so a filter, a tab or a sort never sets it off and the first page opens without it. Home and the browser's Back sweep right to left. The colours are the `--primary` token. The page region's fade from ADR 0054 stays.

The demo's default runs the band behind the content. On the Docker build it showed mostly in the margins, because OrderPilot's pages are almost all cards, so the AI first switched to the demo's "stripes over the content" mode. Azri asked for it back behind the content:

```text
please move the transition to only the background so as to not hinder workflow speed
```

The band, its fill and the page's name (or a record's number) now sweep between the aurora and the content, so they never cross a word or take a click.

## 3. What the AI found that shaped it

The end-to-end tests run with reduced motion (`playwright.config.ts`), so the first screenshots showed no sweep at all; that proved the reduced-motion switch, and the screenshots were retaken with normal motion. The stripes enter fast, so a frame at 200 ms has already missed them; the screenshots froze the animation at set moments instead. A link clicked while frozen stripes were on screen still opened.

Each new test was seen failing against code broken on purpose: Back sweeping the wrong way, reduced motion ignored, a sweep on the first page, and a record page without its number.
