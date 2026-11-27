# Design system: Spectra

Spectra is OrderPilot's one design. The team picked it from three directions on 13 Nov 2026, and on 14 Nov Richie asked for its prototype screens to be the real pages. This page says what it is and where it lives in the code. [ADR 0054](../adr/0054-spectra-is-the-products-design-and-its-prototype-screens-are-the-pages.md) records the decision.

- **Story:** P-107 (#245), with P-106 (#244).
- **One design.** There is no direction switch, no `data-direction` and no other theme but light and dark. A test (`styles/tokens.test.ts`) says so.
- **Where the pick came from.** The three directions, Ink, Paper and Spectra, were shown as pictures of the home page and one order page, light and dark, at 1440 by 900. They are kept in [`docs/design/directions/`](directions/) as they were shown.

## Spectra, in one paragraph

A navy ground with large teal and cyan aurora blooms (a pale aqua sky with teal blooms in light). Work happens on glass over it: translucent panels with a blur, a 16 px card radius, 12 px controls, pills for chips and bar buttons, a soft glowing edge in place of hard borders, a teal accent (`#2EE6D6` on dark, `#0E7C86` on light), and Geist with tabular figures. The side panel and the top bar float as glass, 12 px from the edges. The current entry of the panel is a pill with a teal glow. The page title is gradient text. A panel that holds a table or a form is opaque enough for 4.5:1 text contrast over the brightest part of the ground. It is calm and exact, in the spirit of Linear and Stripe's dashboard: dense where people work, and no motion on a table or a form in use.

The teal and navy are our own. No colour was sampled from Spectra's briefing material and the design carries no logo (question Q-23, on showing the client's name or logo, was not asked).

## Tokens

The source is [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css): light values on `:root`, dark values on `.dark`. Components use the names through Tailwind (`bg-background`, `text-muted-foreground`, and so on), never raw values. The main ones:

| Role                      | Token                       | Light                | Dark                 |
| ------------------------- | --------------------------- | -------------------- | -------------------- |
| Ground (under the aurora) | `--background`              | `#f2f9fa`            | `#06162b`            |
| Foreground                | `--foreground`              | `#0b2239`            | `#f1fbfb`            |
| Muted text                | `--muted-foreground`        | `#2f4658`            | `#b3ccd1`            |
| Accent                    | `--primary`                 | `#0e7c86`            | `#2ee6d6`            |
| Accent as text            | `--accent-foreground`       | `#0b7480`            | `#2ee6d6`            |
| Panel (glass)             | `--panel`                   | white at 82%         | navy at 72%          |
| Panel that holds work     | `--panel-strong`            | white at 92%         | navy at 88%          |
| Card                      | `--card`                    | white at 86%         | navy at 70%          |
| Border                    | `--border`                  | navy at 10%          | white at 10%         |
| Destructive               | `--destructive`, `-surface` | `#b3261e`, `#fbe3e1` | `#ff8e86`, `#3d1a1d` |
| Warning                   | `--warning`, `-surface`     | `#8a5a00`, `#fbefd0` | `#ffc85a`, `#3a2c0f` |
| Success                   | `--success`, `-surface`     | `#0b6b45`, `#d9f2e8` | `#5ee6a8`, `#0d3329` |

Also in the file: `--info`, `--faint-foreground`, `--ring`, the sidebar set, `--ground-image` (the aurora, as radial gradients), `--glow`, `--shadow-card`, `--shadow-pop`, and the `--dx-*` variables for the glass cards, the panel's current entry, the gradient title and the bar buttons.

`styles/tokens.test.ts` measures the contrast of every text and surface pair over the sampled ground, in both schemes, and pins the status colours on their surfaces. It is the proof of the 4.5:1 rule, because axe cannot see through glass over a gradient.

## Type

Seven sizes and no more, set once as `--type-*` in `tokens.css`. Tailwind's `text-*` classes (`styles/index.css`) and the `fs-*` classes (`styles/type.css`) both read them.

| Size  | Token       | Tailwind class | Class   |
| ----- | ----------- | -------------- | ------- |
| 12 px | `--type-12` | `text-xs`      | `fs-12` |
| 14 px | `--type-14` | `text-sm`      | `fs-14` |
| 16 px | `--type-16` | `text-base`    | `fs-16` |
| 18 px | `--type-18` | `text-lg`      | `fs-18` |
| 20 px | `--type-20` | `text-xl`      | `fs-20` |
| 28 px | `--type-28` | `text-2xl`     | `fs-28` |
| 32 px | `--type-32` | `text-3xl`     | `fs-32` |

The typeface is Geist (Geist Mono for code), self-hosted from the npm package (`styles/fonts.css`). Figures use tabular numbers (the `numeral` class).

## Spacing and radii

- **Spacing** is an 8-pt grid: `--space-1` to `--space-8` are 8, 16, 24, 32, 40, 48 and 64 px (there is no `--space-7`), used in layout as the `s1` to `s8` classes. Tailwind's own 4 px scale stays for fine detail inside a line of text or a control (a label over its value, a title over its description): 4 px is the one off-grid step allowed there. `tokens.test.ts` keeps every `--space-*` and the four rhythm tokens below on the grid.
- **Radii:** `--radius` 14 px, `--radius-control` 12 px, `--radius-card` 16 px and `--radius-pill` 999 px. Tailwind's `rounded-sm` to `rounded-xl` derive from `--radius`.

## Hierarchy and rhythm

One set of levels and one rhythm, set in the tokens and the shared parts, so that a page follows them without choosing. The type scale is unchanged (the seven sizes above); only weight, colour and space tell the levels apart. Colour has three tiers: ink (`--foreground`) for what a person reads or acts on, body (`--muted-foreground`) for the sentence that explains, faint (`--faint-foreground`) for small print.

| Level                | Use                                                            | Size and weight                 | Colour      | Class or part                                           |
| -------------------- | -------------------------------------------------------------- | ------------------------------- | ----------- | ------------------------------------------------------- |
| L1 Page title        | The h1                                                         | 28 / 600, gradient              | Teal        | `.dx-title` (`PageHeader`, `HomeHeader`, `OrderHeader`) |
| L1b Page intro       | The line under the title                                       | 14 / 400, 65 characters at most | Body        | `.dx-page-intro`; the date line `.dx-title-context`     |
| L2 Card title        | A section card's title                                         | 16 / 600                        | Ink         | `.dx-section-title`, `.sc-title`                        |
| L2b Card description | Under the card title                                           | 14 / 400, 65 characters at most | Body        | `.sc-description`, `.dx-section-intro`                  |
| L3 Block title       | A heading inside a card: a group of rows, a metric, a step row | 14 / 600                        | Ink         | `.dx-block-title`                                       |
| L4 Body              | Rows, cells and sentences                                      | 14 / 400, 500 for the lead item | Ink or body | `text-sm`, `fs-14`                                      |
| L5 Small print       | A date, a code, a hint, a label above a value                  | 12 / 400                        | Faint       | `.dx-meta`                                              |
| L6 Numbers           | A KPI, a stock figure, an order value                          | 28 or 20 / 600, tabular         | Ink         | `.numeral`, `fs-28`, `fs-20`                            |
| L7 Control text      | Buttons, tabs, inputs, chips                                   | As the control sets it          | As set      | The control                                             |

The faint tier is for text on a card or a panel only. On the bare ground it measures 2.6:1 in light and 3.5:1 in dark, below 4.5:1, so a page head, the date line and a hint that sits on the ground stay in the body colour. `tokens.test.ts` measures every faint pair on `--card`, `--panel-strong`, `--popover` and `--secondary`, and the body colour on the ground.

The rhythm is four tokens, all multiples of 8 px, declared in `tokens.css`. A fifth, `--dx-measure` (72 characters, class `.dx-measure`), is the longest line of prose or small print.

| Token           | Value | Where it applies                                                                                             |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| `--dx-card-pad` | 24 px | The padding of every section card, and the order page's status, journey and details cards                    |
| `--dx-head-gap` | 24 px | From the page head to the first content, on every page                                                       |
| `--dx-stack`    | 32 px | Between the major blocks of a page: sections, stacked cards, the list group and what follows it              |
| `--dx-grid-gap` | 24 px | Between cards side by side and inside a grid of cards: Home's pair, Insights' grid, the order page's top row |

`.dx-page` is the one page stack: a flex column with `gap: var(--dx-stack)`. A page root carries `dx-sheet dx-page` (72 rem, for a page that reads or a record) or `dx-sheet-wide dx-page` (100 rem, for a page of tables and lists) instead of its own `space-y-*` or `gap-*`. A head inside the stack pulls itself 8 px back, so its space to the first block is the head gap and not the stack; a skeleton head (`.dx-skel-head`) does the same, and a back link above a head (`.dx-back`) sits 8 px over it, so a page and its skeleton do not move when the page arrives. Inside a card, groups are 24 px apart, a block title is 8 px over its items, and a tile that sits in a card has a 12 px corner (`--radius-control`) against the card's 16 px.

| Thing                                     | Value                                                            |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Page gutter (`.dx-main`)                  | 24 px, 16 px on a phone (unchanged: the table fits depend on it) |
| Title to date line, title to intro        | 4 px, 8 px                                                       |
| Card head to body                         | 16 px, with the description 4 px under the title                 |
| Stat tile padding                         | 16 px (a tile is denser than a card)                             |
| Label over its value in a fact            | 4 px                                                             |
| Form: label to control, control to hint   | 8 px, 4 px                                                       |
| Form: row to row, column to column        | 24 px, 16 px                                                     |
| Dense bar: control to control, row to row | 8 px                                                             |
| Dense bar to its table                    | 16 px                                                            |
| Tab strip to its panel                    | 16 px                                                            |
| Table rows and cells                      | Unchanged: header 36 px, rows 40 px, `px-3 py-2` cells           |
| Empty and error panel                     | 48 px over 24 px, 8 px between its parts                         |

Tables keep their density. A table is where more space slows the job, so the breathing room goes around it (the bar above, the card padding, the head gap) and not inside it. Control heights and the 44 px touch targets are unchanged. [ADR 0063](../adr/0063-one-hierarchy-and-one-rhythm.md) records the decision.

## Optical alignment

Optical alignment is placing things so they look aligned to the eye, not only to the grid. Text and icons are not drawn edge to edge in their boxes, so boxes that line up can still look off. The rules are in [`styles/optical.css`](../../apps/web/src/styles/optical.css), their tokens in `tokens.css`, and each says in a comment what it corrects. The shared parts use them, so a screen never nudges a pixel itself. The numbers are measured: Geist (units per em 1000, ascender 1005, descender 295, cap height 710, read from the font file) and Lucide 1.61.0 (each icon's path data).

| Utility or token                                          | What it does                                                                                                                                                             | The measured reason                                                                                                                                                            | Used by                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `.text-trim-start`                                        | Trims the space above the capitals (`text-box: trim-start cap alphabetic`); with `--optical-keep` at 1 it gives the space back as padding under the text                 | A 16 px line has 6.1 px above its capitals and a 14 px line 5.1 px, so a card's first line sat 4 to 5 px further from the top edge than from the left edge                     | Card heads (Section, HomeSection, SectionCard without buttons), KPI tile label, count tile label |
| `--optical-keep`                                          | 0 (in use): a card head is 5.6 px shorter and the gap under its title stays; 1 gives the space back, so the card keeps its height and the gap grows 6.3 px               | The trim removes 5 to 6 px per card head or tile; the ink moves up by that much and the body stays, which is why the gap grows at 1                                            | `.text-trim-start`                                                                               |
| `.icon-after-trim`                                        | Moves an icon up with the trimmed text it sits beside                                                                                                                    | `mt-0.5` centred a 16 px icon on a 20 px line; the letters moved up 5.0 px                                                                                                     | The arrow of a count tile                                                                        |
| `.optical-start` with `--optical-inset`                   | Pulls a heading left by its first letter's side space, in em, and gives the space back on the right                                                                      | At 28 px a stem letter (N, M, R, D) starts 2.2 px inside its box, S 1.5, G and O 1.2, W 1.0, A 0.5, T 0.3, Y overhangs 0.2; `lib/opticalEdge.ts` holds all 36 values           | Page title, Home greeting, order number, nested page title (every header)                        |
| `.lucide-chevron-right`, `-left`, `.lucide-play`          | Moves the icon 1 unit (1/24 of its box) toward its tip, with `translate`                                                                                                 | A chevron's mass is on its open side, 1.00 unit from the box centre: 0.67 px at 16 px, 0.58 px at 14 px                                                                        | Breadcrumbs, pagination, shortcuts, the menu's sub-menu arrow, the sign-in stage                 |
| `.lucide-triangle-alert`, `-upload`, `-download`, `-lock` | Lifts the icon 1 unit                                                                                                                                                    | The weight is low: 2.32 units for the warning triangle (1.35 px at 14 px), 2.07 for upload, 2.45 for download, 1.46 for the padlock. 1 unit is half, so none is over-corrected | Status chips and badges, file drop zones, masked values, the top bar's Upload                    |
| The select's chevron (`[data-slot="select-trigger"]`)     | Moves it 1 unit down                                                                                                                                                     | ChevronDown's mass is high, 1.00 unit above its centre                                                                                                                         | Select                                                                                           |
| `data-icon-edge` and `--optical-icon-end`, `-start`       | Moves a button's content 1.15 px right (an icon after the label) or 0.7 px left (an icon before it): one side's padding grows and the other's shrinks by the same amount | Measured for a 16 px ArrowRight (3.3 px of empty box, label bearing about 1 px: the content sat 1.15 px left of centre) and a 16 px Upload (0.7 px right); residuals below     | Every Button with one icon (a direct svg) and a label, in all four sizes and as a link           |
| `-me-1` and `-me-0.5` on an end chevron                   | Pulls the chevron into the control's padding                                                                                                                             | The user menu's chevron ink ended 16.7 px from the edge, the avatar 12 px from the other; the select's 16 px, the data table's select 14 px                                    | User menu, select                                                                                |
| `.dx-sh-title`, `.dx-sh-count` (pinned to the first line) | Centres the count pill on the title line, not the baseline: flex-start plus a 2 px margin, (24 - 20) / 2, the place centring gave a one-line title                       | The pill's capitals sit 5.00 px above its baseline, the title's 5.68 px: the pill was 0.68 px low                                                                              | Section header with a count                                                                      |

What was left alone, on purpose:

- **Labels in controls.** A Geist line box is already centred on the capitals, whatever the line height, because its ascent minus its cap height (295 units) equals its descent (295). Capitals and digits in buttons, badges, chips, inputs and menu entries measured within 0.3 px of centre, so a trim would change nothing there, and in a shell whose height comes from its line height it would shrink it. Lowercase-heavy labels sit about 0.05 em (0.7 px at 14 px) low on their ink; text snaps to whole pixels, so that cannot be drawn reliably and cap centring is the convention.
- **Counts.** With tabular figures every digit sits in a 600-unit cell with its ink centred to within 1 unit (0.01 px at 12 px). All count badges already use them (`numeral`, `tabular-nums`, `data-numeric`), and a test keeps it so; a proportional 1 would sit 0.42 px left of centre.
- **Arrows, circles, X, Plus, Search, Bell and the other icons** within 0.3 unit (0.2 px) of centre. Arrows have a centred bounding box, and their heavy head is what makes them read as arrows.
- **Chevrons that turn** (open and close). `translate` is applied outside `rotate`, so a nudge for a chevron pointing down would push it the wrong way once it points up. Vertical chevrons are corrected only inside a select, where they do not turn.
- **The gradient title's box.** The page title only moves sideways (the heading start above) and its box is never trimmed, because the gradient is painted inside the box and a box that ended on the baseline would lose the fill of the descenders of g, p, q and y (4.2 to 4.5 px at 28 px). The trim only ever trims the start, so a gradient heading could carry it safely.
- **Browsers.** The trim (`text-box`) works in Chrome and Edge 133 and later and in Safari 18.2, and is ignored in Firefox, which keeps today's look: the rule and the padding that gives the height back sit in one `@supports`, so they come and go together. The heading start, the icon nudges, the button shift and the chevron pulls are plain CSS and apply everywhere.
- **Card heads that are not trimmed.** A SectionCard with buttons beside the title (the title is centred on them and a trim would lift it off that line), the order page's journey card (its title has a pill beside it), and the order facts and the order status labels. They keep the air above the title they had, so on a page that mixes them the first lines can sit about 6 px apart from the card top.

**What the trim does to spacing.** The trim moves the ink of a card title or tile label up by 5 to 6 px. `--optical-keep` is 0: the body moves up with it, so the gap under the title stays as it was (23 px from the baseline to the body, before and after) and the card head is 5.6 px shorter (44 to 38.4 px), measured in Edge on a Docker build on 22 Nov. At 1 the trimmed space is given back under the text, so the card keeps its height (within 0.7 px) but the gap under the title grows to 29.3 px. 0 was chosen from the before and after pictures: at 1 the title drifts away from the body it heads. Changing the token is the whole switch.

**What the button shift was measured for.** The 1.15 px and 0.7 px come from a 16 px ArrowRight after the label and a 16 px Upload before it, which is every size except xs. Known residuals: an xs button (12 px icons, 2.5 px of empty box) is about 0.3 px off, and a leading Plus and a trailing ArrowUpRight are about 0.5 px off. The shift applies only when the button has a direct svg child (`has-[>svg]:`), so a component that draws no svg beside a label keeps the base padding.

No control changed size. Fixed heights stay, a padding-sized part has its padding moved by what the correction moves, and a test (`styles/optical.test.tsx`) checks the CSS strings:

| Part                                          | Height before and after                                                                                                                                                                                                                            | Padding before and after                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Button default, xs, sm, lg                    | `h-9`, `h-6`, `h-8`, `h-10`, and `min-h-11` on a coarse pointer                                                                                                                                                                                    | `px-3`, `1.5`, `2.5`, `4` with an icon; one side +1.15 px (or -0.7 px) and the other the same amount less, so the sum is unchanged |
| Icon buttons                                  | `size-9`, `6`, `8`, `10`, `size-11` on a coarse pointer                                                                                                                                                                                            | None (one child, no edge set)                                                                                                      |
| Card head (Section, HomeSection, SectionCard) | The title box shrinks by the trim (6.1 px at 16/24). With `--optical-keep` at 0 (in use) the head is 5.6 px shorter, measured in Edge (44 to 38.4 px); at 1 the padding under the text grows by 6.3 px and the card keeps its height within 0.7 px | Unchanged (`--dx-card-pad`)                                                                                                        |
| KPI tile, count tile                          | The same trim, 5.1 px at 14/20. The count tiles measured 96 px tall before and after: their row sets their height                                                                                                                                  | Unchanged (`p-4`)                                                                                                                  |
| Select trigger and user menu                  | `h-9` / `h-8` and 40 px                                                                                                                                                                                                                            | Unchanged: the chevron's negative margin comes out of the padding, and the name beside it takes the 2 to 4 px                      |
| Count pill beside a title                     | 24 px (the title's line) either way                                                                                                                                                                                                                | None                                                                                                                               |
| Headings                                      | Unchanged: the margin moves the box and gives the space back                                                                                                                                                                                       | None                                                                                                                               |

## Motion

- **Durations:** `--motion-fast` 160 ms, `--motion-base` 220 ms and `--motion-slow` 250 ms, with the `--ease-out` curve. Spatial movement uses springs (`--spring-stiffness` 260, `--spring-damping` 28).
- **A page change** fades the page region alone ([`app/shell/PageRegion.tsx`](../../apps/web/src/app/shell/PageRegion.tsx)). It is a view transition named `dx-page`, keyed by the path alone, so a filter, a tab, a sort or the side peek (all in the query string) never moves it. The old page leaves in 140 ms and the new one arrives in 220 ms, scaling up from 0.985 with a blur that clears (`styles/motion.css`). The panel and the top bar stand still. Browser Back and Forward change the page at once, because React skips view transitions there.
- **The page's name glides across** on the same page change, with the same key ([`app/shell/PageWipe.tsx`](../../apps/web/src/app/shell/PageWipe.tsx), `styles/page-wipe.css`, [ADR 0055](../adr/0055-the-page-name-glides-on-a-page-change.md)). The new page's name, or a record's number, in large teal capitals and led in by one slanted teal stripe, glides through the clear strip under the top bar, right of the title, in 850 ms: above the aurora, behind every card, panel and word, so it never covers anything or takes a click. Home and Back glide right to left. Nothing waits for it: the page has changed before the name arrives.
- **A theme switch** opens the new theme as a circle from the control used, with a soft edge, over 420 ms (`lib/themeSwitch.ts`, `styles/theme-switch.css`). That is longer than a control's 150 to 250 ms because it crosses the whole window. A change that comes from the device (the choice is "system") cross-fades in 250 ms.
- **Reduced motion:** the theme change and the page change are instant, the page's name does not glide, and the kit's moving items hold a still frame.
- Tables and forms never animate while they are in use.
- **Loading:** a skeleton block that stands for a page head, a card, a tile, a chart or a panel shimmers, a faint band of light sweeping left to right in 1.6 s (`.dx-shimmer`, transform only). The rows of a table or a list, and the cards of a board, stay still (`<Skeleton still />`): a table is never animated while it is in use, and a wall of moving rows is not calm. Under reduced motion every skeleton is a still grey block, with the band removed. A progress bar (`components/common/ProgressBar.tsx`) shows only real progress: it glides between the real values it is given, never goes backwards and never runs on a timer.

## Scroll areas mark the side that has more

[`ScrollRegion`](../../apps/web/src/components/common/ScrollRegion.tsx) is the one scroll area behind the tables and boards, and it shows which side of itself has more ([ADR 0071](../adr/0071-scroll-areas-mark-the-side-that-has-more.md)).

- **What the mark means.** A quiet strip, 32 px wide, on the left or right edge of the visible box says that more content lies that way. It is on the right at the start, on both edges in the middle and on the left at the end, and it is not drawn at all when everything fits. It follows the scroll position and a change of size with no reload. Only left and right are marked: a tall area already shows a cut row and keeps its heading in view.
- **Padded boxes.** A browser pins a sticky box inside a scroll box's padding, so the script reads the padding and moves the frames back by it. A scroll box with padding (the order peek) keeps its marks on its visible edge. Seen in Edge; a tablet browser is not yet checked.
- **Where it comes from.** Nothing is set by a page. Each `ScrollRegion` draws its own mark, so every table and board gains it, and a page does not choose, move or hide it. The colour is `--sr-edge` in `ScrollRegion.css`: in light a neutral shadow (black at 6%), in dark the theme's teal at 12%, fading to nothing. It is neutral in light because a teal tint darkens the card but not teal link text, which fell to 4.06:1 under it. A test blends it over the work card and the plain card, over the text as well as the card, and keeps the text colours, link text and the accent text of a selected row at 4.5:1 or more under its strongest point. One pair cannot keep 4.5:1: link text (teal) on the plain card in light is exactly 4.50:1 before any mark, so any mark over it is under 4.5. At this strength it is 4.35:1, and the test holds it to a named floor of 4.33. This is a tolerance, not a pass of the rule. It reaches only the outermost pixels of the 32 px band, where the gradient is strongest, and only while a link sits at the very edge of a scrolled box with no pinned cell over it.
- **What it is not.** It takes no click and no tab stop, and a screen reader skips it. It is never a mask: a frozen first column is drawn over it, and a pinned heading row is not shaded. It does not animate the table: the mark itself fades in over `--motion-fast`, and not at all under reduced motion. In forced colours it is a 1 px line in the system text colour, and in print it is not drawn.
- **The stacking order a pinned cell keeps.** The left mark is `z-index: 0`, the right mark `z-index: 5`. A frozen column is `z-1` or more, so it covers the left mark. A pinned heading cell is `z-10` or more, so it covers both. A pinned row menu at `z-1` sits under the right mark, so it does not hide it. A new pinned cell follows the same order.
- **Two cases for the owners.** Where a table's first column is pinned (the data table does so at every width), the left mark is covered by that column on purpose, and only the right mark shows. A scroller nested inside a `ScrollRegion` (the `pre` on governance's Refusals tab) gets no mark, because the region itself does not overflow. The size is measured again only when the region or its first child changes size, as the tab stop always was, so a change confined to a later sibling is not seen.

## The shell

The shell is `apps/web/src/app/shell/`. It is one screen tall: the panel and the top bar stand still, and only `main` scrolls.

- **The side panel** floats as glass, 12 px from the edges, 16 rem wide. It holds the role's menu in four groups: Work, Stock and buying, Insights and Control (`panelMenu.ts` builds them from the role's menu). A role that has both Orders and the order tracker gets one Orders row, which stays current on the tracker's pages. The current entry is a teal pill. Settings and Help are fixed rows at the foot of the navigation.
- **The rail** is the 64 px collapsed panel: icons only, each with a tooltip. It is the choice below 1024 px unless the person chose otherwise.
- **The sheet** is the panel as a slide-in sheet on a phone (below 768 px), opened from the top bar.
- **The top bar** holds, from the left: the menu button (phone) or the collapse toggle, the breadcrumbs (the panel's group, the route, then the record number), search and jump (opens the command palette, Ctrl K), Upload, Spark, notifications, the demo role switcher and the theme switch. The theme switch leaves the bar below 640 px, and sits at the foot of the phone menu.
- **The theme switch** is the Pixel Day-Night Toggle (`components/kit/pixel-toggle/`, [ADR 0062](../adr/0062-a-day-night-switch-replaces-the-theme-menu.md)): a two-way switch with a glass knob, a pixel moon and sun that scatter and re-form, and a band of light around the knob. On is the light theme (the sun) and off is the dark theme (the moon). It is a button with the switch role, as tall as the bar's other controls (`--bar-ctl`: 36 px, and 44 px on a touch screen) and keeping its own proportions (520 by 272), so it is 69 by 36 px, and 84 by 44 px on a touch screen. The same sizes hold at the foot of the phone menu and in the sign-in corner (`.signin-theme`). It shows the theme that is on the page, also while the choice is System, and follows a change made in Settings, the command palette or the device with no sound. Using it chooses Light or Dark; System stays in Settings, Appearance, as "Match my device". The click sound plays only for a person's own switch. Its focus ring is the app's own, full size. It draws only while it moves, and switches at once under reduced motion.
- **The account menu** is at the foot of the panel: the signed-in person's row opens Settings and Sign out. In the rail only the initials show.
- The shell's menus, popover and sheet are loaded after the first paint (`app/shell/overlays/`), to keep the entry bundle small ([ADR 0035](../adr/0035-the-shell-loads-its-overlays-after-the-first-paint.md)).

## Page anatomy and the three templates

Every page has the same anatomy: the header, then the filters and actions, then the content. Three templates carry it, so a new page starts in the design.

| Template | Takes the anatomy of | Built from                                                                                                                                |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A list   | The Orders workspace | `components/list-page`, `components/common/data-table`, the shared `ph-*`, `dt-*`, `tabs-*` and `sr-region` classes                       |
| A record | The order page       | The `dx-sheet` column (72 rem), the quiet back link, the gradient title with its status chip, cards, `KeyFacts` and `RecordTable`         |
| A form   | The order page       | `components/document-form` (head, sticky action bar, cards, tabs), `components/lines-grid`, `components/form` and the shared control skin |

- **A list** has the gradient title with a count, the labelled filter row with More filters, the applied filters as pills, one glass work card holding the table (40 px rows, a sticky head, tabular figures) and one foot.
- **A record and a form** have the back link above the head (8 px over it), the title with its status chip, an action bar, and cards one stack (32 px) apart.
- **The shared states** are drawn by `components/common/states.tsx` and `StatePanel`: loading (a skeleton in the page's own shape: home, list, record, form or settings, shown after 140 ms), empty (naming the next step), failed (with a retry and a trace id), partial and permission denied. The not found, forbidden and crash pages use the same anatomy, inside the shell.

## The settings pattern

The Settings page follows the settings of products people already know (GitHub, Linear, Stripe, Vercel). A `<nav>` of sections stands at the left and shows one section at a time, chosen by `?section=`; below 768 px it is one scrolling row of pills, 44 px high on touch screens and fading at the end edge to say there are more. Each section is a few glass cards, and each card is a list of rows (`components/parts/SettingRow`): a label, one plain line, and the control or the value at the right. A row says only what a person needs to act. There is no Save button, because a choice applies at once and is kept on the device, and a quiet footnote says so. The title has no date. Nothing here is a primary button: Sign out, Reset, Check again and Open are outline buttons. A section the role may not open is not listed, and a stale link to one gets the permission-denied state.

## The kit

`apps/web/src/components/kit` holds 27 items, one component per file. Each file's header comment names its vendor, the item and its licence, and the item is adapted to the tokens. The gallery at `/gallery/kit` shows them (a demo session or a development build).

| Vendor            | Licence, from the header    | Items                                                                                                                                            |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Magic UI          | MIT                         | animated-list, blur-fade, border-beam, animated-circular-progress-bar, dot-pattern, number-ticker, shine-border, animated-shiny-text             |
| React Bits (free) | MIT with the Commons Clause | Aurora, BlurText, GlassSurface, GradientText, HoldButton, LatticeLoader, Orb (and its shader), PromptBar, SpotlightCard, StatusMark, ThoughtLine |
| ReUI (free)       | MIT                         | alert, badge, use-file-upload, file-type, frame, stepper, timeline                                                                               |
| Ours              | n/a                         | `StatusChip` (the ReUI badge in its status colours), `canvas/` (the shared WebGL canvas), `env.ts`, `kit.css`                                    |

- **The liquid orb.** Spark's WebGPU orb comes from github.com/LerSent001/orb, under the MIT licence, Copyright (c) 2026 LerSent001. The licence text is in `apps/web/src/features/directions/spark/orb/LICENSE`, beside the code. Its graphics program is prepared once for the page (`orb/orbGpu.ts`), with the asynchronous `createRenderPipelineAsync` so the compile never pauses the page, and ahead of the first open while the browser is idle. Every orb borrows it and owns only its canvas. An orb drawn in CSS from the same tokens is on screen from the first render and the drawn orb fades in over it on its first frame, so there is never an empty square; the holder's `data-showing` says which one a person sees. Idle moves visibly (the four bands are spread apart in lightness and hue, and the idle flow runs at speed 2), and thinking is livelier. The orb falls back to React Bits' WebGL Orb, and where neither works, or under reduced motion, to the CSS orb: still under reduced motion, and moving gently otherwise ([ADR 0057](../adr/0057-sparks-orb-is-prepared-once-and-ahead.md)).
- **Pro blocks: none.** No file under `apps/web/src` names a React Bits Pro or ReUI Pro registry or block (searched on this branch), and every kit header above names a free item. CLAUDE.md section 9 rule 8 limits Pro code to Richie's own pages (the shell, sign-in, home, Spark, upload, settings and empty states), and no Pro block has been needed.
- The product's own parts (journey rail, due timer, status tag, KPI tile, masked value, sections, page header) are in `apps/web/src/components/parts`.

## Upload and Spark

Upload (`/upload`) and Spark (the panel opened from the top bar) are demo parts. They run on demo documents and scripted answers, and show only in a demo session or a development build (`app/shell/demoParts.ts`), Upload only to a role with `documents.upload`. Each says on its own page that it is a demo: a file added to Upload stays in the browser and is not stored, and Spark's answers are scripted with no AI model connected. They stay labelled as demos until P-18 (uploads and the AI document pipeline) and P-17 (the AI gateway) make them real.

The Spark panel works like a window on Windows. Maximise (a square, beside Close) fills the width, edge to edge, and Restore (two squares) puts it back at the side; a double click on its head does the same, as on a title bar. Maximised, the conversation keeps a 72-character measure in the middle. The width grows in 220 ms, at once under reduced motion, and the panel keeps its size when it is closed and opened again. On a phone, where it already fills the screen, the button is hidden (`features/directions/spark/SparkHead.tsx`, `spark.css`).

## Where the code lives today

- Tokens and styles: `apps/web/src/styles/`.
- The shell and the page region: `apps/web/src/app/shell/`.
- The prototype screens, now the real pages (home, Orders workspace, order page, Upload, the kit gallery) and Spark: `apps/web/src/features/directions/`. Moving them to their final folders, and renaming the `directions-*` text files, is a follow-up. It changes nothing a person sees.
- Shared templates and parts: `components/list-page`, `components/common`, `components/document-form`, `components/lines-grid`, `components/form`, `components/parts` and `components/kit`.

## Pictures

The pictures of the real pages, in light and dark, from a Docker build of the branch, are in [`docs/design/screenshots/spectra/`](screenshots/spectra/).
