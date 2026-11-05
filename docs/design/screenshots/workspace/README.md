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

Taken from the real API in demo mode (the Vite dev server on this branch, an API and database of its own), with Playwright at 1440 by 900 and 390 by 844. All data is synthetic demo data.

- `<role>-<page>-<width>-light.png`: each role's two main pages that P-45 touched, in light. The system admin has the users tab, Finance and the Auditor have the exceptions queue, and the rest have the order tracker and the task inbox. The home pages are not retaken: this story does not change them.
- `tracker-selected-log-*`: the order tracker with one row ticked, the count, the batch bar and the operation log at the foot, in light and dark.
- `users-selected-log-*-dark`: the users tab with one user ticked and that user's operation log (who, when and what, no field values and no IP address).
- `tracker-row-menu-*`, `tracker-column-settings-*`, `tracker-saved-views-*`: the row menu, the column settings (show, hide and order) and the saved views, in light.
