# Area 2, prompt 009: Spark maximises like a window

No story owns this: it is UI polish for the proposal demo, in area 1's Spark panel, so Richie reviews it. Azri's prompt is quoted as typed, and the rest is summarised.

```text
please make the spark chatbot window expandable like how you expand a normal window on windowsOS
```

## What the AI built

The panel was a 420 px column at the right. Its head gained a Maximise button, a square, between New conversation and Close; maximised, the panel fills the width edge to edge and the button becomes Restore, two squares, as on Windows. A double click on the head toggles it too, as on a title bar, and a double click on one of the head's buttons counts only as two clicks on that button. Maximised, the conversation keeps a 72-character measure in the middle, so an answer's lines and table stay readable. The width grows in 220 ms with the motion tokens, at once under reduced motion. The size survives closing and opening the panel, because the panel stays mounted once opened. On a phone the panel already fills the screen, so the button is hidden.

## What the AI found that shaped it

jsx-a11y refuses a mouse handler on a plain element. The double click repeats the Maximise button, which keyboard and screen reader users already have, so the one line carries a disable comment with that reason, as the codebase does once elsewhere (`object-storage.ts`).

Each new test was seen failing against code broken on purpose: a double click on the Restore button that also resized the panel. In the browser the panel measured 420 px at the side and 1424 px maximised, with no console error.
