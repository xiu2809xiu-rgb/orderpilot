# Loading skeletons, issue 426

Pictures of the skeleton states, taken from a Docker build of commit `181cfbe5` (the review site at http://localhost:4472, with fresh synthetic data, labelled "Synthetic demo data" in every picture). All pictures were taken in the installed Microsoft Edge (version 158.0.4370.33, driven by Playwright with `channel: "msedge"`, headless), signed in as the demo persona Support (Management for Insights, which has no picture here).

## How the wait was held

Each picture is a page whose data requests were held back with `page.route`, so that the skeleton stays on screen:

- Home, Orders and the order page (SO-0110): every request under `/api/v1/` except sign-in, the shell's own badges (tasks, exceptions, reminders) and notices.
- Upload: a file named `po-boxed-so-0102.pdf` was added, Read with Spark was pressed, and the request for `/demo-documents/po-boxed-so-0102.json` was held.

The analytics consent card was dismissed in the browser's local storage before each load, so that it does not cover the foot of the page. The scripts that took them are kept outside the repository.

## The pictures

Each name is `<page>-<size>-<theme>.png`. Desktop is 1440 by 900. Phone is 390 by 844 with touch.

| Pictures                                          | What they show                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home-desktop-light.png`, `home-desktop-dark.png` | Home while its data is held. The timeline rows and the number tiles are still grey blocks (lists). The "Orders in each step" card at the foot is a card skeleton and carries the band. |
| `home-phone-light.png`, `home-phone-dark.png`     | The first screen of Home on a phone. The card with the band is below the fold here, so this picture shows only still blocks.                                                           |
| `orders-desktop-*.png`, `orders-phone-*.png`      | The Orders table while its rows load. Every row is a still block, as the story asks for tables. No band.                                                                               |
| `order-desktop-*.png`, `order-phone-*.png`        | The order page SO-0110 while its data is held. Five card and heading blocks, all with the band.                                                                                        |
| `upload-desktop-*.png`, `upload-phone-*.png`      | Upload's wait for the demo document: the head card, the progress card with its ring, the page and the field rows, all with the band.                                                   |
| `band-moving-strip.png`                           | Three frames of the band moving across Upload's page block, light above dark, about 300 ms apart. The caption of each frame is the band's translation as the browser computed it.      |
| `upload-desktop-light-reduced-motion.png`         | The same wait with reduced motion on. The band is removed: the blocks are plain grey.                                                                                                  |

## What the pictures cannot show

- Motion. A picture is one instant. The band is only faint light, so a single frame shows a soft lighter patch at best. The strip shows it in three places, and the numbers in the pull request (computed animation, speed) are the proof of the movement.
- The glide of a progress bar. The file row's bar (`ProgressBar`) has no picture, because a local file is read in milliseconds and no frame with the bar between 0 and 100 was caught.
- The sizes of the real content. The pictures show the skeleton, not the page that replaces it.
