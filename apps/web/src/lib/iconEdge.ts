import { Children, isValidElement, type ReactNode } from "react";

/** Which end of a button's label an icon sits on. */
export type IconEdge = "start" | "end";

const isText = (node: ReactNode): boolean =>
  typeof node === "string" || typeof node === "number";

/** A component element (a Lucide icon), not a DOM element such as a span. */
const isIcon = (node: ReactNode): boolean =>
  isValidElement(node) && typeof node.type !== "string";

/** Text that is there for a screen reader only takes no room, so it is not counted. */
const isHiddenText = (node: ReactNode): boolean =>
  isValidElement<{ className?: string }>(node) &&
  typeof node.type === "string" &&
  (node.props.className ?? "").split(" ").includes("sr-only");

/**
 * Where the one icon of a button is: before the label (`start`), after it
 * (`end`), or neither, for a button with no icon, an icon alone, or an icon
 * on both sides. CSS cannot tell, because a text node is not a child element,
 * and the two cases need opposite corrections (the Button sets
 * `data-icon-edge` from this, and its sizes read it). `asChild` buttons hand their
 * content to a link, so the content is read from the link's own children.
 */
export function iconEdge(
  children: ReactNode,
  asChild = false,
): IconEdge | undefined {
  let content = children;
  if (asChild) {
    const only = Children.toArray(children)[0];
    if (!isValidElement<{ children?: ReactNode }>(only)) return undefined;
    content = only.props.children;
  }
  const parts = Children.toArray(content).filter((c) => !isHiddenText(c));
  if (parts.length !== 2) return undefined;
  const [first, second] = parts;
  if (isIcon(first) && isText(second)) return "start";
  if (isText(first) && isIcon(second)) return "end";
  return undefined;
}
