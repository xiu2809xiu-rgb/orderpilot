import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { deferredModule, prefetch } from "@/lib/deferred";

// The tooltip's code is a chunk of its own: it loads when a word is first
// pointed at or focused, and is not in the shell's first load.
export const tipModule = deferredModule(() => import("./TermTipBody"));

/** How long a tip outlasts the pointer, so the pointer can cross onto the tip. */
const LEAVE_MS = 120;

/**
 * What opens a word's tip: the pointer on the word or on the tip, or keyboard
 * focus. Native listeners, because the word is not a control and the lint
 * rules refuse handlers on a static element. The first pointer or focus also
 * asks for the tooltip's code, and the tip opens when it arrives.
 */
export function useTermTip(word: RefObject<HTMLElement | null>) {
  const [armed, setArmed] = useState(false);
  const [pointer, setPointer] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const enter = useCallback(() => {
    window.clearTimeout(timer.current);
    setPointer(true);
  }, []);
  const leave = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPointer(false);
    }, LEAVE_MS);
  }, []);
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setPointer(false);
    setFocused(false);
  }, []);
  useEffect(() => {
    const el = word.current;
    if (!el) return;
    const arm = () => {
      prefetch(tipModule);
      setArmed(true);
    };
    const onEnter = () => {
      arm();
      enter();
    };
    const onFocus = () => {
      arm();
      setFocused(true);
    };
    const onBlur = () => {
      setFocused(false);
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      window.clearTimeout(timer.current);
    };
  }, [word, enter, leave]);
  return { armed, open: pointer || focused, enter, leave, close };
}
