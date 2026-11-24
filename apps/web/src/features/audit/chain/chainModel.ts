import type { AuditChainCheck } from "@orderpilot/shared";

/** What a block shows: checked and fine, where the chain breaks, or not known. */
export type BlockState = "verified" | "broken" | "waiting";

export interface ChainBlock {
  readonly state: BlockState;
  /** A sequence number the check returned, or null: no other block is numbered. */
  readonly sequence: number | null;
}

/** What the card knows about the chain at this moment. */
export type ChainKnowledge =
  | { readonly kind: "never" }
  | { readonly kind: "checking" }
  | { readonly kind: "failed" }
  | { readonly kind: "checked"; readonly result: AuditChainCheck };

export interface ChainModel {
  /** Oldest first. Empty when there is nothing to draw: an empty trail. */
  readonly blocks: readonly ChainBlock[];
  /** True when there are more events before the first block than fit. */
  readonly earlier: boolean;
  /** A light runs along the chain: only while a check is running. */
  readonly travelling: boolean;
  /** How many blocks fit across: the picture is laid out in this many slots. */
  readonly slots: number;
}

const waiting = (count: number): ChainBlock[] =>
  Array.from({ length: count }, () => ({ state: "waiting", sequence: null }));

/**
 * The picture of a chain check, from what the check returned and nothing
 * else (F-10). The check sends a count and at most two sequence numbers, so
 * only the newest verified event and the break are numbered: sequence numbers
 * can have gaps, so the ones in between are not worked out. It reports no
 * progress, so a running check shows a light that loops, never a count. It
 * stops at the first break, so nothing is drawn after a break.
 */
export function chainModel(
  knowledge: ChainKnowledge,
  slots: number,
): ChainModel {
  const fits = Math.max(2, Math.floor(slots));
  const base = { slots: fits, earlier: false, travelling: false };
  if (knowledge.kind === "never" || knowledge.kind === "failed") {
    return { ...base, blocks: waiting(fits) };
  }
  if (knowledge.kind === "checking") {
    return { ...base, blocks: waiting(fits), travelling: true };
  }
  const { result } = knowledge;
  if (result.ok) {
    const shown = Math.min(result.checked, fits);
    const blocks: ChainBlock[] = Array.from({ length: shown }, (_, index) => ({
      state: "verified",
      sequence: index === shown - 1 ? result.verifiedThrough : null,
    }));
    return { ...base, blocks, earlier: result.checked > shown };
  }
  // The break takes one slot; the verified events before it fill the rest.
  const before = Math.min(result.checked, fits - 1);
  const blocks: ChainBlock[] = [
    ...Array.from({ length: before }, (_, index) => ({
      state: "verified" as const,
      sequence: index === before - 1 ? result.verifiedThrough : null,
    })),
    { state: "broken", sequence: result.brokenAtSequence },
  ];
  return { ...base, blocks, earlier: result.checked > before };
}

/** Where block `index` of `count` sits across the picture, 0 to 1: centred in its slot. */
export function slotCentre(
  index: number,
  count: number,
  slots: number,
): number {
  const offset = (slots - count) / 2;
  return (offset + index + 0.5) / slots;
}
