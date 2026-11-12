import type { AnyDefinition } from "./definition.js";
import { KINDS } from "./kinds/index.js";
import { DOCUMENT_KINDS, type DocumentKind } from "./model.js";

/** The definition of a kind. A name that is not a kind is a caller's bug, so it throws. */
export function definitionOf(kind: DocumentKind): AnyDefinition {
  if (!DOCUMENT_KINDS.includes(kind)) {
    throw new RangeError(`No ${kind} documents`);
  }
  return KINDS[kind];
}
