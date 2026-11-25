# ADR 0066: The chain picture is one shader on the GlCanvas kit, and draws only what the check returns

- **Status:** Accepted. Angelyn chose direction A and the GlCanvas kit on 23 Nov 2026.
- **Date:** 2026-11-24
- **Story:** F-10 ([#370](https://github.com/xiu2809xiu-rgb/orderpilot/issues/370))

## Context

The chain check on the audit page answers in words: "Verified up to sequence N" or "Broken at sequence N". F-10 adds a picture of the chain beside them, so the answer is quicker to read and a break is hard to miss.

What the check returns limits what any picture may show. `GET /audit/chain` returns whether the chain verifies, how many events were checked, the last sequence that verifies, and, when it breaks, the sequence and the event where it breaks. It returns no list of events and reports no progress while it runs. It stops at the first event that does not fit, so it says nothing about the events after a break. Sequence numbers can have gaps, so the numbers between the two it returns cannot be worked out.

Three directions were drawn with three.js on 23 Nov:

- **A:** glass blocks in a row, seen from the front.
- **B:** the newest in front, older events receding.
- **C:** flat tiles on a quiet grid, seen from above.

Three ways to draw them were weighed, measured as lazy chunks with React left out (gzip):

| Engine                                | Size    | Licence                       |
| ------------------------------------- | ------- | ----------------------------- |
| three.js 0.187.0                      | 136 KB  | MIT                           |
| React Three Fiber 9.8.2 with three.js | 252 KB  | MIT                           |
| The same with drei and postprocessing | 306 KB  | MIT, with postprocessing Zlib |
| A fragment shader on the GlCanvas kit | 4.01 KB | Ours; the kit is already here |

The GlCanvas kit (`components/kit/canvas/GlCanvas.tsx`, Richie's) already draws the sign-in stage's shaders. It caps the pixel ratio at 2, pauses off screen and in a hidden tab, draws one still frame under reduced motion, falls back to CSS without WebGL2, and frees its context on unmount.

## Decision

1. **Direction A, drawn by one fragment shader on GlCanvas.** The blocks are rounded boxes found by ray marching, joined by thin links. There is no new dependency, and the picture is its own lazy chunk of 4.01 KB gzip. The initial JS stays at 228.3 KB.
2. **The camera is orthographic, one unit per slot.** Block _i_ sits exactly in slot _i_, so the numbers are HTML under the canvas, placed by `slotCentre`, with no projection. Seven blocks fit from 640 px wide, four below.
3. **It draws only what the check returns** (`chainModel.ts`):
   - The only numbers are the newest verified sequence and the break. The blocks between them are not numbered.
   - The oldest block fades when more events were checked than fit.
   - Nothing is drawn after a break.
   - A running check shows a light that loops along the chain, with no count.
   - An empty trail draws nothing.
4. **It moves only while a check runs, and for under a second after.** That is the time the blocks take to light up, left to right. Otherwise it rests. Under reduced motion it is a still picture.
5. **The words stay the result.** The picture is `aria-hidden`. A screen reader hears the badge and the sentence, as before. F-10 adds one sentence to a broken chain: "The check stops at the first break, so the events after it are not checked."
6. **A click on the red block opens the broken event,** the same link as F-9's "Open event N", built by one helper. It is for a mouse only: it sits in the hidden picture, out of the tab order, and the keyboard and a screen reader use "Open event N" under the picture.
7. **Its colours are tokens,** read by the kit's `useTokenRgb`: the primary and destructive colours, the foreground, and the page background. The card's colour is not used: the build writes its see-through value as an 8-digit hex, which the kit cannot read, so the glass came out grey.

## Alternatives considered

- **Directions B and C.** B recedes in perspective, so its numbers need a projection, and the far end crowds and drops them. C reads as a table rather than a chain.
- **three.js, or React Three Fiber with drei and postprocessing.** Between 136 and 306 KB for one picture on one card, for a scene a single shader draws. React Three Fiber stays P-23's choice for the 3D scene, which this does not pre-empt.
- **SVG or CSS only.** It gives no glass and no light. It is kept as the fallback without WebGL2.

## Consequences

- Area 4 keeps a shader. jsdom cannot compile one, so the browser test (`audit-chain.spec.ts`) is the check that it compiles and links: it was seen failing with a syntax error put in the shader.
- When F-9's third criterion (a check in the background, with progress) is built, the looping light can follow the real progress.
- The kit's colour reader does not read an 8-digit hex. That is Richie's to decide. This picture avoids it by reading the page background.
- The broken screenshots, and the browser test of the red block's click, use a staged answer on the two newest real events, because the real trail verifies.
