# Two-step sign-in: pictures

Pictures for the two-step sign-in story (#380, [ADR 0068](../../../../adr/0068-two-step-sign-in-with-an-authenticator-app.md)). Each one comes in light and dark, named `<name>-light.png` and `<name>-dark.png`.

## How they were taken

- **From a Docker build of the branch.** The API and web images were built from the commit named under "Build" below and run as a review site with fresh synthetic data, with this branch's migration applied.
- **In Microsoft Edge** (not the test Chromium), driven by Playwright at 1440 by 900, with the operating system's colour scheme set to light or to dark. Motion was on.
- **As a real person would:** the Management account, signed in by password through the page, turning two-step on from Settings, Account, signing out, and signing in again. Codes were computed from the setup key shown on the page.
- **No working secret is in any picture.** The QR code, the setup key and the ten recovery codes are covered with a grey box before the picture is taken, and the account's two-step was turned off again at the end of each pass.

## What each shows

| File                     | What it shows                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `card-off`               | Settings, Account: the "Two-step verification" card with two-step off, the footnote and the demo sentence |
| `card-on`                | The card with two-step on: since when, Turn off, and the recovery codes left with New recovery codes      |
| `setup-1-password`       | The setup dialog, first step: the password again (a password session). Typed dots only                    |
| `setup-2-scan`           | Second step: the QR code and the setup key (covered), the six empty cells and the ring on the first       |
| `setup-2-verifying`      | The same step a moment after the sixth digit: the cells fold into the "Verifying" pill                    |
| `setup-3-recovery-codes` | Third step: the ten recovery codes (covered), Copy, Download, and Done waiting for "I have saved"         |
| `signin-step-empty`      | The sign-in page after a right password: the six empty cells, with the unfold finished                    |
| `signin-step-phone`      | The same step on a 390 pixel wide screen                                                                  |
| `signin-step-wrong`      | A wrong code: red cells and digits, the failure with its trace ID, held for 900 ms before it clears       |
| `signin-step-verified`   | A right code: the green "Verified" pill, with Verify, the recovery switch and Back disabled               |

## Build

Taken on 25 Nov 2026 from commit `0558977c` of the branch `feat/area1-two-step-sign-in`. The commits after it change documents and four things no picture here shows: the recovery-code mode (its focus, its words and its status line), the note when fewer than six digits are entered, a digit typed into the middle of a full code, and the page when the second step fails to load.
