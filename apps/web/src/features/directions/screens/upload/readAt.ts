import type { CSSProperties } from "react";
import type { DemoField } from "./demoDocument";

/**
 * When the reading light reaches a field: how far down its page the field
 * sits, from 0 at the top to 1 at the foot. The box on the page and the row in
 * the list both carry it, so a field appears in both places at the same
 * moment. The style sheet turns it into a delay; it has no other effect.
 */
export function readAt(
  field: DemoField,
): CSSProperties & { "--read-at": number } {
  return { "--read-at": field.box[1] };
}
