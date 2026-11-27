# Settings part 1: one row per setting, more room between groups, the actions that undo set apart (#430)

Every sheet puts the same panel from two builds side by side. The left column is main before this story, the right column is the branch. Pictures are cropped below the lowest card of either column. The Account panel's order and gaps are part 2 (#431), so its groups are still 32 px apart.

## Builds

| Column | Commit                                   | Web image      | API image      |
| ------ | ---------------------------------------- | -------------- | -------------- |
| Before | main `cec11dcb` (merge of #418)          | `22827a9de1ab` | `f635559911f2` |
| After  | `7f87ef3c` of `feat/area1-settings-rows` | `7f473e504449` | `22fd541bc588` |

Both were built with Docker, served on the review site at port 4472 with the same fresh synthetic data (the four newer migrations applied to its database, because its data template predates them). The pictures and numbers are from the installed Microsoft Edge (Playwright `channel: "msedge"`, headless, motion on, device scale factor 1), signed in as demo personas: Support for Account, Appearance and Shortcuts, System admin for Health. Desktop is 1440 wide, the phone is 390 wide with touch. The windows are taller than the usual 900 and 844 (1500 and 2600) so that a whole panel shows. Synthetic demo data only.

## The sheets

Each name ends in the theme (`light` or `dark`).

| Sheet                      | Panel                         | What to look at                                                                                                                                                                                                  |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account-desktop-*`        | Account, 1440                 | "What you can do" is a list of rows: the name at the left, its sentence in a 20 rem column at the right. Sign out is a destructive outline (red border and words, no fill).                                      |
| `account-phone-*`          | Account, 390                  | The sentence of each row is under its name, left aligned, 16 px below it. Sign out is the destructive outline at 44 px high.                                                                                     |
| `appearance-desktop-*`     | Appearance, whole panel, 1440 | Four groups: Theme, Layout, Region, Reset. The groups are 48 px apart (32 before). Layout holds the side menu only. The last group, Reset, holds the table layouts reset as a destructive outline with its icon. |
| `appearance-phone-*`       | Appearance, whole panel, 390  | The Layout card is absent where the side menu is a sheet (its only row used to be the reset), so there are three groups, and Reset is still last.                                                                |
| `shortcuts-desktop-*`      | Keyboard shortcuts, 1440      | The two groups are 48 px apart (32 before). The rows inside a group are closer (32 px between rows, 48 before). The keys stay at the right.                                                                      |
| `health-desktop-*`         | System health, 1440           | The details are rows: the service name at the left, its state chip at the right. Rows are 48 px apart (32 before).                                                                                               |
| `reset-toast-desktop-*`    | Appearance, after, 1440       | The toast after "Reset" with its Undo button, with a saved layout seeded.                                                                                                                                        |
| `signout-dialog-desktop-*` | Account, after, 1440          | Sign out over a form with unsaved changes opens the same question as before, with focus on "Keep editing". See the note on how the dirty form was made.                                                          |

## Measured spaces

Card edge to card edge is the distance from the bottom of one card to the top of the next, from `getBoundingClientRect`. Between rows is the space between one row's content and the next row's content, which is the two paddings and the divider. The numbers are the same at 1440 and at 390 and in light and dark.

| Panel and list                  | Before (main)   | After (branch) |
| ------------------------------- | --------------- | -------------- |
| Appearance, between cards       | 32 px           | 48 px          |
| Appearance, Region rows         | 48 px           | 32 px          |
| Shortcuts, between cards        | 32 px           | 48 px          |
| Shortcuts, rows in a card       | 48 px           | 32 px          |
| Account, between cards          | 32 px           | 32 px          |
| Account, "What you can do" rows | a `dl`, no rows | 48 px          |
| Health, details rows            | 32 px           | 48 px          |
| AI assistant and Controls rows  | 48 px           | 48 px          |

The Account, AI, Controls, Health and Privacy panels were not given the wider group gap or the closer rows: the issue limits that to Appearance and Shortcuts, and Health, AI, Controls and Privacy are one card each. The Health details rows got looser, not closer, because they now use the default row.

## Name and value columns

| List              | Width | Before                                            | After                                                                                            |
| ----------------- | ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "What you can do" | 1440  | name at x 573, sentence at x 765 (a fixed column) | name at x 573 (302 px), sentence at x 907 (320 px, ends at the card's content edge), on one line |
| "What you can do" | 390   | sentence under the name                           | sentence under the name, at the same x as the name, 16 px below it                               |
| Health details    | 1440  | name at x 573, chip at x 1134 (92 px)             | the same: name at x 573, chip at x 1134, on one line                                             |
| Health details    | 390   | name and chip on one line (chip at x 256)         | chip under the name, at x 41, 16 px below it                                                     |

The accessibility tree of "What you can do" (Edge, `ariaSnapshot`) is a `list` with five `listitem`s, each holding two paragraphs: the name, then the sentence. The old `dl` pairing of name and sentence is by order only now.

## Buttons

| Button                | Before, 1440 / 390        | After, 1440 / 390   |
| --------------------- | ------------------------- | ------------------- |
| Reset (table layouts) | 72 by 36 / 72 by 44       | 88 by 36 / 88 by 44 |
| Sign out              | 104.6 by 36 / 104.6 by 44 | the same            |
| Check again           | 131.7 by 36 / 131.7 by 44 | the same            |

## Contrast of Reset and Sign out

Words and border are `rgb(179, 38, 30)` in light and `rgb(255, 142, 134)` in dark (the destructive token). Colours are computed colours; the fill and the card are the pixel under them, read from a picture of the page with every text drawn transparent (median of the button's inside, away from the border; the border pixel on the top edge against the card just above it). Touch has no hover, so the hover rows are desktop only.

| Button   | Theme | Words on resting fill     | Words on hover fill       | Border on the card |
| -------- | ----- | ------------------------- | ------------------------- | ------------------ |
| Reset    | light | 6.13 (fill 242, 249, 250) | 5.35 (fill 251, 227, 225) | 6.41               |
| Reset    | dark  | 8.18 (fill 6, 22, 43)     | 6.94 (fill 61, 26, 29)    | 7.58               |
| Sign out | light | 6.13                      | 5.35                      | 6.40               |
| Sign out | dark  | 8.18                      | 6.94                      | 7.06               |

Phone readings (no hover): words 6.13 light and 8.18 dark, border on the card 6.45 to 6.46 light and 7.49 to 7.56 dark. All are over 4.5:1 for the words and 3:1 for the border. The focus ring is the shared 3 px ring at half strength (teal), drawn on both buttons.

## axe

`@axe-core/playwright`, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, on Account, Appearance, Shortcuts, Privacy (Support) and Health, AI assistant, Controls (System admin), at 1440 and 390, light and dark, on both builds: 0 violations in every one of the 28 readings of each build.

## How the dirty form was made

No form on the Account panel can hold unsaved changes in this build (the forms that do come with #391, #398 and #423). To see Sign out ask first, the page registered a form the way a form does: it imported the built chunk that holds the app's own dirty-form registry (the same module, since the address is the same) and called its register function with a function that returns true. The sheet shows the real dialog from the real Sign out button. The unit tests "asks first, with the same dialog, when a form holds unsaved changes" and "signs out at once when nothing is unsaved" cover the same two paths in `SessionCard.test.tsx`.
