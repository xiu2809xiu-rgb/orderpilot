Taken on 20 Nov 2026 from a Docker build of this branch at commit 319f7b8e, on the synthetic demo data.

Nothing here was pressed that records something: the script only reads, filters and opens the More filters panel.

| File                              | Role and page                                                     | What it shows                                                                                               |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| orders-1366-light.png             | Support, /orders, 1366 x 768, light                               | The default view with the side panel open: eight columns, no cut text, no sideways scroll                   |
| orders-1366-dark.png              | Support, /orders, 1366 x 768, dark                                | The same in the dark theme                                                                                  |
| orders-held-1366-light.png        | Support, /orders?view=held, 1366 x 768, light                     | Held up: each held order says why under its stage                                                           |
| orders-search-po-1366-light.png   | Support, /orders?q=4471-26, 1366 x 768, light                     | A search for 4471-26 finds the order and the PO number column shows the match, with 707 short as the reason |
| orders-page-99-1366-light.png     | Support, /orders?page=99, 1366 x 768, light                       | A page number past the end opens the last page: the count is right and no empty state                       |
| orders-range-error-1366-light.png | Support, /orders?from=2026-11-10&to=2026-11-01, 1366 x 768, light | More filters with a From after its To: the error is at the field and the panel stays inside the window      |
| orders-820-light.png              | Support, /orders, 820 x 1180, light                               | A tablet: held at, ship date, value and the PO number move under the order's number                         |
| orders-390-light.png              | Support, /orders, 390 x 844, light                                | A phone: nothing is cut, the four tabs can all be reached, and every fact is under the number               |
