# Quieter labels, the answer louder than its working (#427)

Every sheet puts the same page from two builds side by side. The left column is main before this story, the right column is the branch. The top row is the page as it is. The bottom row is the same page with `document.documentElement.style.filter = "blur(6px)"` set in the page before the picture was taken (the squint test: what is left of the page when the words cannot be read).

## Builds

| Column | Commit                                    | Web image      | API image      |
| ------ | ----------------------------------------- | -------------- | -------------- |
| Before | main `cec11dcb` (merge of #418)           | `1ae1a53f34fa` | `734412f58795` |
| After  | `70a82fd5` of `feat/area1-quieter-labels` | `eb8edc338c51` | `546159c5ba14` |

Both were built with Docker from a clean working copy, served on the review site at port 4472 with the same fresh synthetic data (the four newer migrations applied to its database, so that the pages that read governance notices load). Every picture is from the installed Microsoft Edge (Playwright `channel: "msedge"`, headless, motion on, device scale factor 1), signed in as a demo persona. Desktop is 1440 by 900. The phone is 390 by 844 with touch. The sheets named `home-whole-*` use a 1440 wide window 1900 px tall so that the whole of My timeline shows.

Synthetic demo data only.

## The sheets

Each name ends in the theme (`light` or `dark`).

| Sheet                                                | Page and state                                        | What to look at                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home-desktop-*`, `home-whole-desktop-*`             | Home as Support, with 22 tasks                        | My timeline: the explanation, the "last task is due" line, the empty "Done today" line, the order and customer line under each task and "Usually 1 day" are quieter. Task titles, "Waiting 5 days" and the one filled button, "Upload a PO", keep their weight. |
| `home-phone-*`                                       | Home as Support, 390 wide                             | The same card at the phone size.                                                                                                                                                                                                                                |
| `insights-desktop-*`                                 | Insights as Management                                | On each tile the "By hand" figure is the body colour at normal weight, and the "With OrderPilot" figure is the 600 numeral, so the right-hand figure is the heaviest mark of the tile. Tile heights are unchanged (see below).                                  |
| `settings-account-desktop-*`                         | Settings, Account, as Support                         | The description under "Role" and the line in the Session card are quieter.                                                                                                                                                                                      |
| `upload-waiting-desktop-*`, `upload-waiting-phone-*` | Upload review with 2 fields waiting                   | "Next to approve" is the one filled button. "Finish review" is an outline button, still disabled. The document number line is faint, and no longer 600.                                                                                                         |
| `upload-done-desktop-*`, `upload-done-phone-*`       | The same review after the last field is confirmed     | "Finish review" is the one filled button, as before. The phone pictures are scrolled to the sticky progress card, in both columns.                                                                                                                              |
| `spark-empty-desktop-*`                              | Spark panel, empty, as Management                     | The welcome heading and intro are left-aligned, not centred.                                                                                                                                                                                                    |
| `spark-answers-desktop-*`                            | Spark panel after three answers (stock, sales, stock) | The working line "Looked up the stock" is the muted colour, its timer is faint, and the answer stays in the body colour. The panel is scrolled to the end of the thread, as it does by itself.                                                                  |

Only the first screen of the Home sheet shows My timeline cut off at 900 px, which is why the whole page sheets exist for Home. The Insights and Settings pages fit in the window, so they have no whole-page sheet.

## How the contrast was measured

For each text that changed, the computed `color` was read in the page. The surface under it was read from the picture: the page was drawn again with every text transparent, and the median pixel of the text's box was taken. The ratio is the WCAG 2 relative-luminance ratio of the two.

| Changed text                                                                                                       | Light                                | Dark                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------------------------------- |
| Faint tier (`rgb(82, 107, 124)` light, `rgb(143, 170, 178)` dark) on My timeline, 14 px                            | 5.52 and 5.53 (phone 5.48 to 5.53)   | 7.11 to 7.22                                 |
| Faint tier on a Settings description                                                                               | 5.46 to 5.51                         | 6.70 to 7.10                                 |
| Faint tier on the Upload review document number line and mock note                                                 | 5.46 (desktop), 5.13 to 5.41 (phone) | 6.89 to 6.95 (desktop), 6.16 to 6.65 (phone) |
| Faint tier on Spark's timer "1.5 s"                                                                                | 5.48                                 | 7.20                                         |
| Muted "Looked up the stock" in Spark                                                                               | 9.63                                 | 10.43                                        |
| Muted "By hand" figure on an Insights tile, 28 px                                                                  | 9.02 to 9.69                         | 8.98 to 10.26                                |
| Text of the filled "Next to approve"                                                                               | 4.95 (white on teal)                 | 12.09                                        |
| "With OrderPilot" figure, gradient text, 28 px at 600, the weakest stop on its surface (3:1 applies to large text) | 4.81                                 | 6.26                                         |

The lowest ratio of any changed text that is not disabled is 4.95 (the filled button in light), and 5.13 for the faint tier (a phone). "Finish review" while a field waits is disabled and at half opacity, which WCAG does not hold to 4.5:1. The label of a count tile on Home keeps the muted colour (the faint tier was tried there and failed under the hover fill, see the design system): under the pointer it reads 13.03 in light and 11.42 in dark.

## Did anything move

The box of every text in the page was read before and after (103 to 131 matched texts a page). On Home, Insights, Settings and Upload review no text box moved by more than half a pixel, except the label of the Upload review's progress buttons: the two buttons swapped looks, so "Next to approve" is 153 px wide against 155, "Finish review" is 136 px against 134 while it waits, and the text of "Finish review" sits 2 px further right. Their height is 36 px on desktop and 44 px on the phone, before and after.

## What the blurred pair shows

Read the sheets, not this list, but in short: on Upload review the blurred "before" shows a disabled filled button and a pale outline button side by side, and the "after" shows one dark teal block where the live action is. On Insights the right-hand figure is the heaviest mark of each tile in the "after". On Home and Settings the differences are small, as asked: the lines of explanation are paler, and the title, the task titles and the "Upload a PO" button are as they were.
