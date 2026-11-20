import type { RefObject } from "react";
import { deferredModule, prefetch } from "@/lib/deferred";
import { useHoverTip } from "./useHoverTip";

// The tooltip's code is a chunk of its own: it loads when a word is first
// pointed at or focused, and is not in the shell's first load.
export const tipModule = deferredModule(() => import("./TermTipBody"));

const loadTip = () => {
  prefetch(tipModule);
};

/**
 * What opens a word's tip: the pointer on the word or on the tip, or keyboard
 * focus (the rules are in `useHoverTip`). The first pointer or focus also asks
 * for the tooltip's code, and the tip opens when it arrives.
 */
export function useTermTip(word: RefObject<HTMLElement | null>) {
  return useHoverTip(word, { onArm: loadTip });
}
