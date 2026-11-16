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

- **Spacing** is an 8-pt grid: `--space-1` to `--space-8` are 8, 16, 24, 32, 40, 48 and 64 px (there is no `--space-7`), used in layout as the `s1` to `s8` classes. Tailwind's own 4 px scale stays for fine detail inside controls.
- **Radii:** `--radius` 14 px, `--radius-control` 12 px, `--radius-card` 16 px and `--radius-pill` 999 px. Tailwind's `rounded-sm` to `rounded-xl` derive from `--radius`.

## Motion

- **Durations:** `--motion-fast` 160 ms, `--motion-base` 220 ms and `--motion-slow` 250 ms, with the `--ease-out` curve. Spatial movement uses springs (`--spring-stiffness` 260, `--spring-damping` 28).
- **A page change** fades the page region alone ([`app/shell/PageRegion.tsx`](../../apps/web/src/app/shell/PageRegion.tsx)). It is a view transition named `dx-page`, keyed by the path alone, so a filter, a tab, a sort or the side peek (all in the query string) never moves it. The old page leaves in 140 ms and the new one arrives in 220 ms, scaling up from 0.985 with a blur that clears (`styles/motion.css`). The panel and the top bar stand still. Browser Back and Forward change the page at once, because React skips view transitions there.
- **The broadcast wipe** plays on the same page change, with the same key ([`app/shell/PageWipe.tsx`](../../apps/web/src/app/shell/PageWipe.tsx), `styles/page-wipe.css`, [ADR 0055](../adr/0055-a-broadcast-wipe-on-a-page-change.md)). A slanted teal band, with a stripe and a light line at each edge and the new page's name in the clear strip under the top bar, right of the title, sweeps across the background in 850 ms: above the aurora, behind every card, panel and word, so it never covers anything or takes a click. Home and Back sweep right to left. Nothing waits for it: the page has changed before the stripes arrive.
- **A theme switch** opens the new theme as a circle from the control used, with a soft edge, over 420 ms (`lib/themeSwitch.ts`, `styles/theme-switch.css`). That is longer than a control's 150 to 250 ms because it crosses the whole window. A change that comes from the device (the choice is "system") cross-fades in 250 ms.
- **Reduced motion:** the theme change and the page change are instant, the broadcast wipe does not play, and the kit's moving items hold a still frame.
- Tables and forms never animate while they are in use.

## The shell

The shell is `apps/web/src/app/shell/`. It is one screen tall: the panel and the top bar stand still, and only `main` scrolls.

- **The side panel** floats as glass, 12 px from the edges, 16 rem wide. It holds the role's menu in four groups: Work, Stock and buying, Insights and Control (`panelMenu.ts` builds them from the role's menu). A role that has both Orders and the order tracker gets one Orders row, which stays current on the tracker's pages. The current entry is a teal pill. Settings and Help are fixed rows at the foot of the navigation.
- **The rail** is the 64 px collapsed panel: icons only, each with a tooltip. It is the choice below 1024 px unless the person chose otherwise.
- **The sheet** is the panel as a slide-in sheet on a phone (below 768 px), opened from the top bar.
- **The top bar** holds, from the left: the menu button (phone) or the collapse toggle, the breadcrumbs (the panel's group, the route, then the record number), search and jump (opens the command palette, Ctrl K), Upload, Spark, notifications, the demo role switcher and the theme switch. The theme switch leaves the bar below 640 px; it is in Settings.
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
- **A record and a form** have the back link above the head, the title with its status chip, an action bar, and cards 24 px apart.
- **The shared states** are drawn by `components/common/states.tsx` and `StatePanel`: loading (a skeleton in the page's own shape: home, list, record, form or settings, shown after 140 ms), empty (naming the next step), failed (with a retry and a trace id), partial and permission denied. The not found, forbidden and crash pages use the same anatomy, inside the shell.

## The kit

`apps/web/src/components/kit` holds 27 items, one component per file. Each file's header comment names its vendor, the item and its licence, and the item is adapted to the tokens. The gallery at `/gallery/kit` shows them (a demo session or a development build).

| Vendor            | Licence, from the header    | Items                                                                                                                                            |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Magic UI          | MIT                         | animated-list, blur-fade, border-beam, animated-circular-progress-bar, dot-pattern, number-ticker, shine-border, animated-shiny-text             |
| React Bits (free) | MIT with the Commons Clause | Aurora, BlurText, GlassSurface, GradientText, HoldButton, LatticeLoader, Orb (and its shader), PromptBar, SpotlightCard, StatusMark, ThoughtLine |
| ReUI (free)       | MIT                         | alert, badge, use-file-upload, file-type, frame, stepper, timeline                                                                               |
| Ours              | n/a                         | `StatusChip` (the ReUI badge in its status colours), `canvas/` (the shared WebGL canvas), `env.ts`, `kit.css`                                    |

- **The liquid orb.** Spark's WebGPU orb comes from github.com/LerSent001/orb, under the MIT licence, Copyright (c) 2026 LerSent001. The licence text is in `apps/web/src/features/directions/spark/orb/LICENSE`, beside the code. The orb falls back to React Bits' WebGL Orb, and under reduced motion to a still picture.
- **Pro blocks: none.** No file under `apps/web/src` names a React Bits Pro or ReUI Pro registry or block (searched on this branch), and every kit header above names a free item. CLAUDE.md section 9 rule 8 limits Pro code to Richie's own pages (the shell, sign-in, home, Spark, upload, settings and empty states), and no Pro block has been needed.
- The product's own parts (journey rail, due timer, status tag, KPI tile, masked value, sections, page header) are in `apps/web/src/components/parts`.

## Upload and Spark

Upload (`/upload`) and Spark (the panel opened from the top bar) are demo parts. They run on demo documents and scripted answers, and show only in a demo session or a development build (`app/shell/demoParts.ts`), Upload only to a role with `documents.upload`. Each says on its own page that it is a demo: a file added to Upload stays in the browser and is not stored, and Spark's answers are scripted with no AI model connected. They stay labelled as demos until P-18 (uploads and the AI document pipeline) and P-17 (the AI gateway) make them real.

## Where the code lives today

- Tokens and styles: `apps/web/src/styles/`.
- The shell and the page region: `apps/web/src/app/shell/`.
- The prototype screens, now the real pages (home, Orders workspace, order page, Upload, the kit gallery) and Spark: `apps/web/src/features/directions/`. Moving them to their final folders, and renaming the `directions-*` text files, is a follow-up. It changes nothing a person sees.
- Shared templates and parts: `components/list-page`, `components/common`, `components/document-form`, `components/lines-grid`, `components/form`, `components/parts` and `components/kit`.

## Pictures

The pictures of the real pages, in light and dark, from a Docker build of the branch, are in [`docs/design/screenshots/spectra/`](screenshots/spectra/).
