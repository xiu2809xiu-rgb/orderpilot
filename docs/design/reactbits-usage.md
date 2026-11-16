# Kit items on the sign-in page

Every kit item the sign-in page uses, old and new. Each lives in
`apps/web/src/components/kit/` with its licence in its first line, adapted by
hand to the tokens in `apps/web/src/styles/tokens.css`. Nothing was added with
the CLI's `add`, and no new package was installed.

| Where on the page               | Item                   | Vendor         | Registry                         | Licence                     | Pro | Status                                                              |
| ------------------------------- | ---------------------- | -------------- | -------------------------------- | --------------------------- | --- | ------------------------------------------------------------------- |
| The headline, word by word      | BlurText               | React Bits     | React Bits (free)                | MIT with the Commons Clause | No  | Old, extended with a start delay and an accent on the closing words |
| The closing words of the line   | GradientText (its CSS) | React Bits     | React Bits (free)                | MIT with the Commons Clause | No  | New here: the gradient class is set on the last two words           |
| The three steps                 | SpotlightCard          | React Bits     | React Bits (free)                | MIT with the Commons Clause | No  | New here                                                            |
| The stage's edge                | BorderBeam             | Magic UI       | Magic UI                         | MIT                         | No  | New here                                                            |
| The stage's and the card's edge | ShineBorder            | Magic UI       | Magic UI                         | MIT                         | No  | New here (the card's old light was plain CSS and is gone)           |
| The ground behind the page      | Aurora                 | React Bits     | React Bits (free)                | MIT with the Commons Clause | No  | Old, with a `paused` option                                         |
| Inside the stage                | DepthField             | React Bits Pro | `@reactbits-pro`, item `hero-21` | React Bits Pro licence      | Yes | New: its aurora noise, rebuilt on WebGL2 (see below)                |

## About DepthField

`hero-21` ("Aurora hero with a glowing orb mark") draws its field with `three`.
That package is not installed here and the page must stay small, so the item
was read in full and its look was rebuilt on the page's own WebGL2 canvas
(`canvas/GlCanvas.tsx`): the flowing simplex-noise curtains are adapted from it,
and the stars, the planet with its ring and light, and the perspective floor
are Spectra's own. Two other items were read and set aside: `hero-22` needs
`@paper-design/shaders-react` and `stats-16` needs `three`, and neither is
installed.

Nothing the items did on their own was kept that fetches over the network,
loads a remote script, font or image, or touches storage or cookies.

## Motion rules on this page

- Everything that moves by itself for more than five seconds is held by the
  one Pause button on the stage (`aria-label` "Pause the hero animation",
  "Play the hero animation").
- Under reduced motion: no tilt, no beam, no drifting lights, no video, and a
  still frame in the stage.
- The canvas is decoration (`aria-hidden`), clamps the device pixel ratio to 2,
  and stops when the tab is hidden or the stage is off screen.
