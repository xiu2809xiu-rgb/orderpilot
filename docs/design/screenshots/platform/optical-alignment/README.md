Taken on 22 Nov 2026 in Edge at three times the size (deviceScaleFactor 3), from two Docker builds: main at 064f53af (before) and this branch at 069783d9 (after), on the synthetic demo data, with reduced motion. Each sheet puts the same part side by side, with magenta guides drawn from the measured boxes. The card heads and the count tile also show the branch with `--optical-keep` set to 1, the choice that was not taken. Made by throwaway Playwright scripts that are not kept in the repository.

| File                                                          | What it shows                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `optical-card-heads-light.png`, `optical-card-heads-dark.png` | My timeline, Your numbers, Orders in each step and Needs you, and a count tile: the title moves up to sit as far from the top edge as from the left, and the body comes with it |
| `optical-titles-light.png`, `optical-titles-dark.png`         | The Home greeting against the content edge below it, and a KPI tile's label                                                                                                     |
| `optical-buttons-light.png`, `optical-buttons-dark.png`       | Buttons with an arrow after the label or an icon before it, centred on their content; the pagination chevron, a table's page-size select and the user menu's chevron            |
| `optical-marks-light.png`, `optical-marks-dark.png`           | The warning triangle and the lock lifted by one unit, the breadcrumb chevron, count badges with tabular figures, and the proof that Geist centres capitals in a line box        |

Measured on the same builds (Edge, light theme):

| Part                   | Before (main) | After, `--optical-keep: 0` (in use) | After, if it were 1 |
| ---------------------- | ------------- | ----------------------------------- | ------------------- |
| Card head height       | 44 px         | 38.4 px                             | 44.7 px             |
| Title baseline to body | 23 px         | 23 px                               | 29.3 px             |
| Count tile height      | 96 px         | 96 px                               | 96 px               |

Not pictured: the section count pill (it appears only in the kit's parts demo), the new order form's message (Save stays disabled until the form changes), and the Orders title and the page total (their crops came out too narrow to read).
