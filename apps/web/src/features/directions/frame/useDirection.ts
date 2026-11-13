import { useParams } from "react-router";
import { DEFAULT_DIRECTION, isDirection, type Direction } from "../directions";

/**
 * The direction the preview is showing, from the address. A part that picks
 * a component by direction (a figure's numeral style) reads it here: the
 * `data-direction` on the document is set by an effect that runs after the
 * children have rendered, so it cannot be read during the first render.
 */
export function useDirection(): Direction {
  const { direction } = useParams();
  return isDirection(direction) ? direction : DEFAULT_DIRECTION;
}
