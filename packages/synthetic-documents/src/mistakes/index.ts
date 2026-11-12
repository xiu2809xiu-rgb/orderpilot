import type { BaseFacts } from "../facts-base.js";
import type { DocumentKind, MistakeKind } from "../model.js";

/** Changes the facts of one kind so that a document prints one wrong thing. */
export type Mutation = (facts: BaseFacts) => BaseFacts;

/** The mutations that exist, by mistake and then by kind. None yet: the data plants the first two itself. */
const MUTATIONS: Partial<
  Record<MistakeKind, Partial<Record<DocumentKind, Mutation>>>
> = {};

/**
 * Applies a render-time mistake to the facts, before the fields are built, so
 * the printed text and its box are the changed ones. A null mistake changes nothing.
 */
export function applyMistake<F extends BaseFacts>(
  kind: DocumentKind,
  facts: F,
  mistake: MistakeKind | null,
): F {
  if (mistake === null) return facts;
  const mutation = MUTATIONS[mistake]?.[kind];
  if (!mutation) throw new RangeError(`No mutation for ${mistake} on ${kind}`);
  // A mutation is registered for one kind and takes that kind's facts.
  return mutation(facts) as F;
}
