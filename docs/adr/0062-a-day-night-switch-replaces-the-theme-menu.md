# ADR 0062: A day-night switch replaces the theme menu

- **Status:** Proposed. The shell and the sign-in page are area 1's, so Richie accepts or declines it in review.
- **Date:** 2026-11-22
- **Story:** [#356](https://github.com/xiu2809xiu-rgb/orderpilot/issues/356)

## Context

The theme control was a menu behind a sun or moon icon, with three choices: Light, Dark and System. It sat in three places: the top bar from 640 px, the foot of the phone menu, and the corner of the sign-in page.

On 22 Nov Richie asked to replace it with the Pixel Day-Night Toggle, a component he found in a post by kaolti on X (https://x.com/kaolti/status/2119151022014894260) and supplied as a bundle of five files: a React wrapper (18 lines), an engine (832 lines of JavaScript, with a WebGL2 glass shader, a 2D canvas fallback, the pixel moon and sun, the springs, drag and fling, and a click sound), its type declaration, a generic shadow-DOM runtime (169 lines) and a README. The bundle states no licence.

The bundle draws a fixed 720 x 540 scene, scaled by a CSS transform, with its own background. The bar's controls are 36 px high (44 px on a touch screen) and sit on the app's own ground. At 36 px the toggle's track is 69 x 36 px, and one pixel cell of its moon is about 0.9 CSS px.

## Decision

1. **A two-way switch replaces the Light, Dark and System menu,** in all three places. On is the light theme (the sun) and off is the dark theme (the moon). It shows the theme that is on the page, so under System it shows what the device gives, and it follows a change made in Settings, in the command palette or on the device, with no sound and without choosing again. A person who uses it chooses Light or Dark. System stays in Settings, Appearance, as "Match my device". The new theme still opens from the switch, as the menu's choice did, because `setPreference` reads the last press.
2. **The bundle's code is adapted into the repository, with credit and no stated licence, for a private prototype.** The credit is the header of `components/kit/pixel-toggle/engine.ts`: the post, the date of the bundle and what was changed. The repository is private ([ADR 0040](0040-what-going-private-changed.md)). **Before the repository or the demo site goes public, the author is asked** (a reply to the post or a message), and the component is removed or replaced if the answer is no or never comes. Until then the component is a one-folder change to take out: `components/kit/pixel-toggle/`, `ThemeSwitch.tsx` and a locale key.
3. **The port's structure.** The engine is split by job, in strict TypeScript, and the React component is a thin adapter:
   - `PixelToggle.tsx` renders a native `<button type="button" role="switch">` with `aria-checked` and a name, and a knob span. React owns the button, the name and the state.
   - `engine.ts` is the state machine (springs, drag, fling, the sound). It attaches to the button, makes its own canvases when it mounts and removes them when it is destroyed, and follows the `checked` prop when it changes from outside without calling back. `glass.ts` (the WebGL2 renderer), `paint2d.ts` (the 2D painter), `particles.ts`, `geometry.ts` and `palette.ts` hold the rest. The engine is a closure factory on purpose, as the source was: it sits behind an `update` and `destroy` interface (`PixelToggleEngine`) that a class could later implement without changing `PixelToggle.tsx`.
   - There is no shadow DOM and no scene host. The button is the track: its height is the bar's `--bar-ctl` and its width keeps the switch's own proportions (520 by 272), and the engine draws in CSS px from the size it measures. No transform scales it, so the focus ring (the app's own) stays full size, and a slot with no size (the top-bar slot under 640 px) draws nothing.
   - Fresh canvases on every mount are the answer to React's development double mount: a context lost on a reused canvas shows only the fallback ([`Orb.tsx`](../../apps/web/src/components/kit/Orb.tsx) keeps its canvas and so cannot lose the context).
   - The engine is a lazy chunk (about 9 KB gzip), fetched once the switch is on the page. The button is drawn from CSS alone until it arrives, at the right end for the checked state, and it works as a plain switch if the chunk cannot load. The entry chunk stays within its budget ([patterns](../architecture/patterns.md), "The entry chunk").
4. **WebGL2 with a 2D fallback.** The glass renderer uses a premultiplied-alpha canvas, so that outside the track it paints only a soft shadow and the light it throws, as alpha, in at most 8 CSS px past the track. It draws the glyph mask at the display's density and snaps each cell to whole device pixels (and drops the gap between cells when a cell is under 2 device pixels), because at 36 px a cell is under one CSS pixel and would blur or lose pixels. Where WebGL2 is missing, the shader does not build or the context is lost, the engine draws the supplied 2D version: the CSS track and knob, two ribbons of light and the glyph on a canvas, with its margin cut to about 10 CSS px. Both draw only while something moves, stop when the tab is hidden, and switch at once under reduced motion. The device pixel ratio is capped at 2.
5. **The sound is kept, on by default.** A short triangle tone slides up when the switch goes to day and down when it goes to night. It plays only for a person's own click, key press or drag (the browser's `isTrusted` flag), never for a change from elsewhere, and a `sound` prop turns it off. The audio context is made on the first such switch, so no browser's autoplay rule is met, and is closed with the switch.

## Consequences

- The menu's three choices are two. Someone who wants to follow the device sets System in Settings, Appearance. A person who switches under System leaves it: the choice becomes Light or Dark.
- The palette in `palette.ts` and the first-paint values in `pixelToggle.css` are the same numbers written twice, one for the engine and one for the CSS before the engine runs. A test (`palette.test.ts`) keeps them equal.
- The day track is low in contrast on the light bar (about 1.3:1). The state is also given by the knob's position, the glyph and `aria-checked`, and changing the track would change the supplied look, so it is left.
- A drag starts after 4 CSS px of movement, and a fling is 0.5 px per ms or faster. Both are measured in CSS px and converted with the switch's size at that moment, because at 36 px a track unit is about 0.13 px and a threshold in units would turn a click with a pixel of wobble into a drag.
- If the author says no, the choice of what replaces the menu is Richie's. The previous menu is in Git history before this change.
- Not done here: no drawing was made or checked for forced colours. The button is still there, with the browser's focus ring.
