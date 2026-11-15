# ADR 0054: Spectra is the product's design, and its prototype screens are the pages

- **Status:** Accepted. Azri, Iok Teck and Angelyn are asked to look at their own files in the pull request.
- **Date:** 2026-11-15
- **Story:** P-107, with P-106

## Context

P-106 built three visual directions, Ink, Paper and Spectra, as a preview inside the app: a shell, a home page, the merged Orders workspace, an order page, a sign-in page, an upload screen and Spark. Pictures of the home page and an order page, in light and dark, are kept in `docs/design/directions/`. The team picked Spectra on 13 Nov 2026.

On 14 Nov Richie saw work still going into the preview and into the two directions that were not chosen. He asked for the chosen design to go directly onto the real site, and for only one design to exist. After seeing the old pages in Spectra's colours beside the prototype screens, he wrote that he preferred the prototype: "It is much cleaner and more professional. It organizes information logically." When he saw the prototype Orders screen beside the real `/orders`, he wrote: "I want it to be like the first screenshot, which is cleaner and more premium." So the job was not new colours on old pages. The prototype screens had to become the real pages. At 17:20 that day he also allowed the teammates' pages to be restyled: "you can restyle for them."

[`docs/design/design-system.md`](../design/design-system.md) describes the design itself.

## Decision

1. **One token set and no direction switch.** Spectra's tokens are the app's tokens (`apps/web/src/styles/tokens.css`, light and dark). Ink and Paper are deleted, with no `data-direction` and no branch in any component for another direction. A test says so.
2. **The prototype screens are the pages.** The prototype shell (a floating glass side panel, a top bar and a page region), the home page of every role, the Orders workspace, the order page and the sign-in page became the real pages at the real addresses. The old home, the old Orders list and the prototype sign-in are deleted. There is no `/preview` and no `/directions` route.
3. **One Orders entry.** The panel and the command palette show one Orders entry for the Orders list and the order tracker, because the two lists show the same orders. The merge is made in the shell (`panelMenu.ts`), not in any feature definition. The tracker's own pages still open by address.
4. **Lists, records and forms share templates.** A list takes the Orders workspace's anatomy, a record and a form take the order page's, and the loading, empty, failed, partial and permission-denied states are shared. A new page starts in the design.
5. **The teammates' pages were restyled in the same story, presentation only.** Richie allowed it on 14 Nov. Queries, mutations, routes, data shapes and permission checks in the areas of Azri (workflows), Iok Teck (the tracker, exceptions and insights) and Angelyn (governance, audit and monitoring) were not changed. The pull request lists each owner's files, with one sentence for each.
6. **Upload and Spark are demo parts.** Both are in the top bar, because the picture Richie wanted shows them there. Both run on demo documents and scripted answers, show only in a demo session or a development build, and say on their own pages that they are demos. They stay so until P-18 (uploads and the document pipeline) and P-17 (the AI gateway).
7. **The theme switch animates.** A person's choice opens the new theme as a circle from the control used. A change from the device cross-fades. Reduced motion makes both instant. A page change fades the page region alone.

## Alternatives considered

- **Keep the three directions behind a switch.** Rejected: Richie asked for one design, and a switch would leave two designs to test and to keep in step.
- **Give the old pages Spectra's colours and keep their layout.** Rejected: it was tried first, and Richie preferred the prototype's layout and the way it organises information.
- **Restyle only the shared parts and give each owner a list of changes.** This was the default until 14 Nov. Rejected once Richie allowed the restyle: it would have left three areas looking unlike the rest of the product until each owner found the time.
- **Move the prototype screens out of `features/directions/` in the same pull request.** Rejected: a large rename inside an already large diff makes the review harder, and it changes nothing a person sees. It is a follow-up.

## Consequences

- **The entry bundle** was 221.8 KB gzip in the last measure of the build log, against the budget of 250 KB. ADR 0035 recorded 202.0 KB on 2 Nov. The figure on `main` at the branch point was not measured for this ADR. The canvas effects (the aurora and the orbs) load lazily and stay out of the entry.
- **Glass over a gradient hides contrast from axe.** The token test measures every text and surface pair over a sampled ground, in both schemes, so the 4.5:1 rule rests on that measurement and not only on axe.
- **A new page is easier to build well,** because the templates carry the anatomy, the states and the 44 px touch targets. A page that ignores them stands out.
- **The pull request is large,** and three owners have files in it that they did not write. Each is asked to look at their own.
- **`features/directions/` is a misleading name** for the folder that now holds the home, Orders, order, Upload and Spark screens, and the `directions-*` text files share it. The move and the rename are a follow-up.
- **Follow-ups, all raised and not fixed here:**
  - #269: what happens to the Order tracker pages, which is Iok Teck's call;
  - #275: task amounts reach roles whose prices are masked, a server-side gap in areas 2 and 4;
  - #276: four findings on area 4's pages;
  - the move out of `features/directions/` and the rename of its text files;
  - making Upload and Spark real, in P-18 and P-17.
- Review at `v0.2-technical-review`.
