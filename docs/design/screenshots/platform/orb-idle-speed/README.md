# The Spark orb at idle, before and after (#337)

Taken on 21 Nov 2026 in Microsoft Edge 157 with WebGPU, at 1366 x 768, from Docker builds on the synthetic demo data, with Spark open as Support. Before: a build whose orb is main's (the branch of #338 at commit 1dc3f588, which does not touch the orb). After: this branch at commit d796c7a5. Made by a throwaway Playwright script that is not kept in the repository.

Each pair is the idle orb one second apart. A still picture cannot show speed, so the measurements below say how much moved.

| File                                                 | Build  | Scheme | What it shows                  |
| ---------------------------------------------------- | ------ | ------ | ------------------------------ |
| `before-idle-light-1.png`, `before-idle-light-2.png` | Before | Light  | The idle orb, one second apart |
| `after-idle-light-1.png`, `after-idle-light-2.png`   | After  | Light  | The idle orb, one second apart |
| `before-idle-dark-1.png`, `before-idle-dark-2.png`   | Before | Dark   | The idle orb, one second apart |
| `after-idle-dark-1.png`, `after-idle-dark-2.png`     | After  | Dark   | The idle orb, one second apart |

## How much of the orb changes

The share of the orb's pixels that changed between two pictures, and the mean change of a pixel (out of 255), each the average of the pairs taken in the same run.

| Orb and gap              | Before       | After        |
| ------------------------ | ------------ | ------------ |
| Light, idle, 0.4 s apart | 8.3% (3.3)   | 25.5% (4.9)  |
| Light, idle, 1 s apart   | 42.1% (9.3)  | 54.1% (12.5) |
| Dark, idle, 0.4 s apart  | 18.3% (4.2)  | 34.1% (6.4)  |
| Dark, idle, 1 s apart    | 47.6% (11.4) | 56.8% (15.5) |
| Light, thinking, 0.4 s   | 32.3% (6.3)  | 48.9% (10.7) |
| Dark, thinking, 0.4 s    | 33.6% (7.8)  | 46.6% (12.6) |
