# List template screenshots (P-44)

Pictures of the list page template, taken from a production build of this branch (`vite preview`). Most were taken with the API answered by synthetic fixtures, because the Docker daemon on the build machine was stopped then; the two touch pictures at the end come from the real API. All data is synthetic demo data. CI's End-to-end smoke job is the check against the real API.

- `items-*`, `customers-*`, `vendors-*`: the three master data lists at 1440 by 900 and 390 by 844, in light and dark, as Product manager.
- `items-more-filters-390-*`: the More filters popover on a phone.
- `reason-dialog-390x844-*` and `reason-dialog-844x390-*`: the Void reason dialog, with its inline error, on a phone upright and on its side. `reason-done-*` shows the toast after it.
- `gallery-list-1440-*`: the gallery's list demo, with the five status chips.
- `gallery-filters-*`: the gallery's list demo with a customer lookup and an Updated date range under More filters, at 1440 and 390 wide.
- `print-items-support.png`: the print view as the browser draws it for paper.
- `gallery-lookup-touch-1024.png` and `gallery-date-range-touch-1024.png`: the lookup and the date range popovers in a real browser (Chromium with touch, so the coarse-pointer rules apply) at 1024 by 768, from the real API in demo mode. Every control in them measures 44 px or more.

## The list grid (P-45)

Taken from a Docker build of this branch (the `migrate`, `api` and `web` images, in a compose project of their own), with Playwright at 1440 by 900 and 390 by 844, in light and dark. All data is synthetic demo data. The order tracker, exceptions queue, task inbox and users tab are not shown: this story leaves them as they are on `main`, and their move onto the template is parked on `wip/p45-owner-screens` for each owner's own pull request.

- `p45-product_manager-<items|customers|vendors>-<width>-<theme>.png`: the three master data lists as Product manager. At 390 the first column carries the next two columns under it, and the row menu stays at the right. The Saved views, Columns, Export and Print buttons sit above the table.
- `p45-support-gallery-<width>-<theme>.png`: the gallery's list, which declares every feature: row checkboxes (24 px, with a 44 px touch target on a phone), select all, the row menu, saved views and columns.
- `p45-support-gallery-selected-<width>-<theme>.png`: the same list with the first row ticked, scrolled to that record's operation log. It says "No changes recorded yet" because the sample orders have no audit events.

## The document form (P-47)

`p47-*`: the gallery's document form from a Docker build of the branch, as Support, the Approver and Warehouse, at 1440, 390 and 1024 (coarse pointer), in light and dark. `docs/design/product-pass-screenshots.md` lists each one and says what it shows.
