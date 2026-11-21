Taken on 21 Nov 2026 from a Docker build of this branch at commit 6813dcb4, on the synthetic demo data; made by a throwaway Playwright script that is not kept in the repository.

## Method

Each run is the installed Edge (headless, a fresh profile, so no compiled program is cached), signed in as Support through the demo sign-in, at 1366 by 768, on a production build. The page under test is brought to the front: a page behind another tab draws about one frame a second, which would be measured instead of the orb. Pauses are the gaps between two animation frames of the page in the 12 seconds after the click on Spark, recorded inside the page with no pictures taken, because a picture waits for the GPU. Idle is four pictures of the orb one second apart, compared pixel by pixel inside the disc: the mean difference per colour channel (0 to 255) and the share of the disc that changes by more than 8. Before is the code of `main` (d66a66f4) built and measured the same way on the same laptop.

## Figures

Two runs of each, shown as first, second.

| Figure                                                        | Before (main)                             | After (this branch), local build            | After, this Docker build                    |
| ------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Orb holder in the page after the click (click 1 s after load) | 349 ms, 347 ms                            | 355 ms, 341 ms                              | 351 ms, 349 ms                              |
| Orb on the screen after the holder is in the page             | an empty canvas until the GPU answers     | the CSS orb, 5 ms, 4 ms                     | the CSS orb, 3 ms, 6 ms                     |
| Longest gap between two frames, 12 s after the click          | 4198 ms, 3654 ms                          | 91 ms, 79 ms                                | 100 ms, 100 ms                              |
| Pauses of over 250 ms in those 12 s                           | 1, 1                                      | 0, 0                                        | 0, 0                                        |
| Longest gap when the click comes 6 s after load               | not prepared ahead                        | 135 ms, 159 ms                              | 73 ms, 93 ms                                |
| Drawn orb on the screen, click 1 s after load                 | the first picture of it at 4.2 s to 4.7 s | 2.8 s, 2.6 s (the compile is still running) | 2.4 s, 2.1 s (the compile is still running) |
| Drawn orb on the screen, click 6 s after load                 | not prepared ahead                        | 585 ms, 612 ms                              | 470 ms, 498 ms                              |
| Second open: first GPU frame after the click                  | 120 ms, 124 ms                            | 42 ms, 43 ms                                | 31 ms, 35 ms                                |
| Second open: the drawn orb after the holder                   | not measurable in the old build           | 26 ms, 24 ms                                | 21 ms, 21 ms                                |
| Idle, mean change per channel in 1 s (light)                  | 2.46, 2.47                                | 6.78, 6.77                                  | 9.54 (steps 9.52, 9.66, 9.43)               |
| Idle, mean change per channel in 1 s (dark)                   | not measured                              | 11.4 (one run)                              | 11.65 (steps 11.54, 11.76, 11.64)           |
| Idle, share of the disc changed by more than 8 (light)        | 5.4%, 5.7%                                | 37.6%, 37.5%                                | 41.6%                                       |
| Idle, share of the disc changed by more than 8 (dark)         | not measured                              | 47.7% (one run)                             | 46.1%                                       |
| Thinking against idle, 0.4 s apart (light)                    | 6.97 against 1.03, 7.07 against 1.07      | 5.83 against 2.99, 5.96 against 3.09        | 5.63 against 2.90, 5.73 against 2.87        |
| Entry bundle, gzip                                            | 227.2 KB                                  | 228.0 KB                                    | 227.9 KB                                    |

The Before and local build columns come from throwaway measuring scripts that are not kept, run against the local preview of each build. The idle figures in the Docker column come from the pictures in this folder; the others are filled from the same measuring scripts run on the Docker build.

More from the Docker build:

- Five runs with no pictures taken gave a longest gap of 100, 100, 100, 77 and 100 ms. One of the two runs that also took pictures during the compile showed a single gap of 275 ms; the other showed 77 ms.
- The measuring script reads the idle orb at another phase of its flow than the pictures here: 6.4 to 7.0 in light over twelve steps, the lowest single step 6.36, with 34% to 38% of the disc changed.
- The CSS orb and the drawn orb are the same size: 124 px and 122 px across in the 168 px holder. The CSS orb has a 1 px ring.

## Files

| File                                     | What it shows                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `welcome-light.png`, `welcome-dark.png`  | The Spark panel just opened: the welcome, with the large orb                          |
| `conversation-light.png`                 | The panel with a conversation: the small orb beside the name                          |
| `upload-reading-light.png`               | Upload's reading stage: the orb is thinking while Spark reads the demo purchase order |
| `idle-light-1.png` to `idle-light-4.png` | The idle orb in light, one second between pictures                                    |
| `idle-dark-1.png` to `idle-dark-4.png`   | The idle orb in dark, one second between pictures                                     |
