# Prompt 010: the Spark orb

Richie's message of 21 Nov 2026, about the orb in the Spark panel, quoted as he typed it.

```text
Also, for the AI ball, I get that you implemented it in Spark, but shouldn't it have an animation? Right now it's just static, not moving, and it takes a few seconds to load, which kind of spoils the UX.
```

## What came of it

- Both points were measured in Edge on his laptop, on a production build. The orb's graphics program was compiled at the moment the panel opened, with the call that holds the page while it runs, which paused the page for about four seconds, and the idle orb changed by a mean of about 2.5 of 255 from one second to the next.
- The program is now prepared once for the page, with the asynchronous call, ahead of the first open while the browser is idle. An orb drawn in CSS is on screen from the first render and the drawn orb fades in over it. The idle bands are spread apart and the idle flow is faster, so it visibly moves. This is issue #326.
