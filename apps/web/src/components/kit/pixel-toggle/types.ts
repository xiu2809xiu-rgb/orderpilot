import type { Box } from "./geometry";
import type { Particles } from "./particles";

/** The control's size in CSS px, the scale from track units to CSS px, and the device pixel ratio. */
export interface Layout {
  width: number;
  height: number;
  scale: number;
  dpr: number;
}

/** What one picture shows: the knob's box and every animated value. */
export interface Frame {
  box: Box;
  /** 0 is night, 1 is day. */
  theme: number;
  /** Where the band of light is, in turns. */
  phase: number;
  /** How hard the band is thrown while the switch changes, 0 to 1. */
  transit: number;
  scatter: number;
}

/** One way to draw the switch. The engine picks the glass renderer, else the 2D painter. */
export interface Renderer {
  resize: (layout: Layout) => void;
  paint: (frame: Frame, dots: Particles) => void;
  destroy: () => void;
}
