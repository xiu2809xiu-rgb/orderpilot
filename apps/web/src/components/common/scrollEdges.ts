/** What a scroll box is given to decide which sides still have content past them. */
export interface ScrollPosition {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export interface MoreSides {
  /** More content lies to the left of the visible box. */
  start: boolean;
  /** More content lies to the right of the visible box. */
  end: boolean;
}

/**
 * Browsers round the scroll sizes and a fractional zoom or a device pixel
 * ratio leaves a sliver, so a box that is a pixel off from the start or the
 * end counts as being there. Without it the mark would stay on a box that
 * cannot scroll any further.
 */
const SLACK = 1;

/** Which sides of a horizontally scrolling box have more to see. Pure, so it needs no layout. */
export function moreSides({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: ScrollPosition): MoreSides {
  return {
    start: scrollLeft > SLACK,
    end: scrollLeft + clientWidth < scrollWidth - SLACK,
  };
}
