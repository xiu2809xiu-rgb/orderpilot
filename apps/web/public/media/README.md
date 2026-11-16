# Sign-in hero media

The sign-in page has a 16:9 stage between the headline and the three steps. It
looks for these files in this folder. Add them and the page uses them with no
code change.

| File               | What it is                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `signin-hero.mp4`  | The hero video, H.264, under 8 MB. Plays in every browser.                                                |
| `signin-hero.webm` | Optional. The same video as WebM, tried first when it is there.                                           |
| `signin-hero.jpg`  | Optional. The first frame of the video, used as its poster and as the still picture under reduced motion. |

## What the video should be

- 1920 x 1080 (16:9), 8 to 10 seconds, a seamless loop: the last frame leads
  into the first with no cut.
- No sound. The page plays it muted, looping and inline, and a Pause button
  sits in the frame's corner.
- Calm movement in the product's colours (deep navy and teal), with the middle
  third kept quiet. No text, no logos, no flashing, nothing that strobes.
- Synthetic content only: no real customer, document or screen.

## When the files are absent

Nothing breaks. The stage shows a live WebGL scene in navy and teal (curtains
of light, three planes of stars, a planet with a ring and a perspective
floor). Under reduced motion it shows the poster when there is one, otherwise
one still frame of that scene. If a file is there but cannot be played, the
page falls back to the scene without an error.
