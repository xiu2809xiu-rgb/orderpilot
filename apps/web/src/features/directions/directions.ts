/** The three visual directions the preview switches between. */
export const DIRECTIONS = ["ink", "paper", "spectra"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DEFAULT_DIRECTION: Direction = "ink";

export function isDirection(value: string | undefined): value is Direction {
  return DIRECTIONS.some((direction) => direction === value);
}

/** The path of a screen in a direction. */
export function screenPath(direction: Direction, screen: string): string {
  return `/directions/${direction}/${screen}`;
}
