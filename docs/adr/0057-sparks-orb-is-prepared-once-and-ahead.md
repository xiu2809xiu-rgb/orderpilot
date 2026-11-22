# ADR 0057: Spark's orb is prepared once, ahead of use, and never while the page waits

- **Status:** Proposed. Spark and the shell are area 1's, so Richie accepts or declines it in review.
- **Date:** 2026-11-21
- **Story:** [#326](https://github.com/xiu2809xiu-rgb/orderpilot/issues/326)

## Context

Spark's orb is the MIT "Liquid Orb", a WebGPU fragment shader of about 69 KB, coloured from the design tokens ([`features/directions/spark/orb`](../../apps/web/src/features/directions/spark/orb)). On 21 Nov Richie looked at the panel and said: "shouldn't it have an animation? Right now it's just static, not moving, and it takes a few seconds to load, which kind of spoils the UX."

Both were measured that day in Edge 157 on his laptop, on a production build of `main`, from a fresh browser profile:

- **The first open stopped the page.** The orb's program was compiled when the panel opened, with `createRenderPipeline`. That call makes the browser's graphics process wait for the shader compiler, so the whole page drew no frame for 3.6 to 4.2 seconds, and for 8.6 seconds in one run while the laptop was busy.
- **Nothing showed meanwhile.** The panel opened with an empty square.
- **Every open made a new GPU device and program** and destroyed them on closing.
- **Idle moved too little to see.** Pictures one second apart differed by a mean of 2.5 of 255 a colour channel, and 5% to 6% of the disc changed by more than 8. The four band colours were close in lightness and hue, and the idle drift was slow.

## Decision

1. **One GPU program for the page.** `orbGpu.ts` asks for the adapter and the device and compiles the program once, whoever asks first, and keeps them for the life of the page. Every caller gets the same promise.
2. **The asynchronous compile only.** The pipeline is made with `createRenderPipelineAsync`. `createRenderPipeline` is not in the type the orb uses, so it cannot come back by accident.
3. **An orb borrows, it never owns.** A `LiquidOrb` holds only its canvas context, its uniform buffer and its bind group. Destroying it frees those and never the device, so several orbs share one program and closing Spark costs nothing.
4. **Never an empty square.** `SparkOrb` draws an orb in CSS from the same tokens on its first render. The drawn orb stays clear until its first frame is on screen, then fades in over about 200 ms, and the CSS orb is taken out of the tree. Where motion is allowed the CSS orb moves gently by itself.
5. **Prepared ahead.** Where Spark is available, the shell waits for the page's load and then for an idle moment, then fetches the GPU module and compiles. A pointer or the focus reaching the Spark button does the same at once. Nothing is prepared in a hidden tab, under reduced motion, without WebGPU, or in a session that cannot open Spark. The entry bundle holds the trigger only.
6. **Idle is visibly alive.** The band colours are spread further apart in lightness and hue, still mixed from the accent and information tokens, and the idle drift is three times faster (thinking is unchanged and stays livelier).
7. **A lost device is forgotten for good.** Every orb that borrowed it is told once and falls back to the WebGL orb, and the page does not try WebGPU again.
8. **Reduced motion is unchanged:** the still orb, no animation and no GPU work.

## Alternatives considered

- **Keep the blocking call and only prepare ahead.** The page would still stop for about four seconds, only earlier, while the person reads Home.
- **Make the WebGL orb the main engine.** Its shader compiles in milliseconds, but it is not the orb Richie chose.
- **Compile in a worker.** The wait is in the browser's graphics process, not on the page's thread, so a worker would not help.
- **Cut the shader down to the one style Spark uses.** It would shorten the compile, which no longer holds the page up. Left for a day when the compile time itself matters.

## Consequences

- **The page keeps drawing.** With the asynchronous call the longest gap between two frames in the 12 seconds after the first click was 79 to 92 ms, against 3.6 to 4.2 seconds before. The compile still takes about three seconds on this laptop; the CSS orb shows for that long on a first open that comes before the page has been idle.
- **A device and a 71 KB chunk in every demo session,** whether Spark is opened or not. The entry bundle grew from 227.2 KB to 228.0 KB of its 250 KB budget.
- **Idle measures 6.7 to 9.8 of 255 in light and about 12 in dark,** with 36% to 47% of the disc changing each second, where it was 2.5 and 5% to 6%.
- **The figures are from one laptop and one browser.** They are written with their method beside the story's screenshots.
