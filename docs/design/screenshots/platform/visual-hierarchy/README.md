# Visual hierarchy and breathing room: before and after

Story [#364](https://github.com/xiu2809xiu-rgb/orderpilot/issues/364), [ADR 0063](../../../../adr/0063-one-hierarchy-and-one-rhythm.md). Every sheet puts the page on main (left) beside the same page on this branch (right), as the Docker review build draws it, in Chromium at 1366 x 768 unless the name says otherwise. Synthetic demo data throughout.

- **Before:** main at f2bf64f3 (the survey pictures).
- **After:** this branch at e2596c4e, built as a Docker image of the branch.

## The sheets

| File                                                         | What it shows                                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `home-support-1366-light.jpg`                                | Home as Support: card padding 24, 8 px between the buttons, a block title over each timeline group, small print |
| `home-support-1366-light-scrolled.jpg`                       | The rest of Home: the steps card with its block titles and the pair of cards at 24 px                           |
| `orders-support-1366-light.jpg`                              | Orders: 24 px from head to the controls, 8 px between controls, 16 px to the table                              |
| `order-so-0080-support-1366-light.jpg`                       | The order page: 24 px card padding, 24 px inside the top row, 32 px between the stacked cards                   |
| `my-tasks-support-1366-light.jpg`                            | My tasks: head 24 px from the tabs, strip 16 px from its list                                                   |
| `exceptions-support-1366-light.jpg`                          | Exceptions: the applied filter 8 px over its table                                                              |
| `customer-detail-support-1366-light.jpg`                     | A customer: head to facts 40 px to 24 px, facts labels in the faint tier                                        |
| `insights-management-1366-light.jpg`                         | Insights: tile titles in ink, 24 px padding and gaps, five tiles of one width                                   |
| `settings-account-support-1366-light.jpg`                    | Settings, Account: the same head gap, cards 24 px padded                                                        |
| `governance-users-1366-light.jpg`                            | Governance, Users: tab strip 16 px from its panel, the table card 24 px padded                                  |
| `audit-auditor-1366-light.jpg`                               | The audit log: the search hint 8 px over its toolbar                                                            |
| `home-support-1366-dark.jpg`, `orders-support-1366-dark.jpg` | Home and Orders in the dark theme                                                                               |
| `home-support-390-light.jpg`, `orders-support-390-light.jpg` | Home and Orders at 390 px with a touch screen                                                                   |

## What was measured

Head to the first block, in px, at 1366 light, on the main build and on this branch (a Chromium probe over the same pages as the survey; the main build used for this reading was the review site's, 28 hours older than f2bf64f3, and it agrees with the survey's own head gaps):

| Page                                                | Before | After |
| --------------------------------------------------- | ------ | ----- |
| Orders, order page, My tasks, Reminders, Exceptions | 16     | 24    |
| Customers, Vendors, Items lists                     | 16     | 24    |
| Audit, Governance, Monitoring                       | 16     | 24    |
| Customer, vendor and item records                   | 40     | 24    |
| Insights                                            | 40     | 24    |
| Order steps                                         | 48     | 24    |
| Home, Upload, Settings (five sections)              | 24     | 24    |

Other numbers, from the survey's measuring script run the same way on both builds:

- **Gaps between sections:** the order page 16 px to 32 px between its stacked cards and 24 px inside its top row. Record pages 24 px to 32 px. Pages at 32 px keep 32 px (Settings, Workflows, Exceptions, Governance, Monitoring), and Audit goes from 24 px to 32 px.
- **Card padding:** every section card is 24 px on all sides (was 20 px). The order page's cards had tops and sides of 8, 14, 16, 18 and 20 px and now use 24 px (the details card keeps 8 px over its tab strip). Stat tiles stay at 16 px, and the Insights tiles went from 16 px to 24 px.
- **Distinct text styles (size and weight):** the same on every page except Insights, 7 to 8 (the 14 / 600 block title). No new size on any page: the sizes are still 12, 14, 16, 20 and 28 where they were used. The number of text colours is one higher on several pages (Home 7 to 8, Insights 3 to 4, the customer, vendor and item records, the approver's My tasks), because the faint tier is now in use.
- **Page height at 1366 x 768:** Home 1788 to 1812 px, the order page 877 to 949, Insights 850 to 954, a customer 793 to 803, Items 1363 to 1379, Orders 2044 to 2060, My tasks 2009 to 2013. Exceptions went down 836 to 832 and the order steps page 1455 to 1427 (its head gap fell by 24 px).
- **Order page at 390 px:** 1402 to 1586 px, the largest growth, from the 32 px stack and the 24 px card padding.
- **Table rows:** 40 px rows and a 36 px head, unchanged. No page scrolls sideways in the probe at 1366 or 390.

What stayed as it was, on purpose: the Orders table (its widths, its cell padding and its 80 px rows), the 36 px control heights and 44 px touch targets, the page gutter, and Home's dead area beside the timeline.
