import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/** How long a tip outlasts the pointer, so the pointer can cross onto the tip. */
const LEAVE_MS = 120;

interface HoverTipOptions {
  /**
   * The element holds the focusable thing instead of being it, such as a
   * wrapper round a button. Focus does not bubble, so the wrapper listens
   * for `focusin` and `focusout`.
   */
  holdsFocus?: boolean;
  /** Called on each pointer or focus, to ask for the tooltip's code; keep it stable. */
  onArm?: () => void;
}

/**
 * When a tip is open: the pointer on the element or on the tip, or keyboard
 * focus. The tip outlasts the pointer by a moment, and the pointer on the tip
 * keeps it open (`enter` and `leave` go on the tip), so its text can be read
 * and selected: WCAG 2.2, 1.4.13 asks that content shown on hover can be
 * pointed at, put away and stays. `close` is for Escape.
 *
 * Native listeners, because the element is often not a control and the lint
 * rules refuse handlers on a static element.
 */
export function useHoverTip(
  element: RefObject<HTMLElement | null>,
  { holdsFocus = false, onArm }: HoverTipOptions = {},
) {
  const [armed, setArmed] = useState(false);
  const [pointer, setPointer] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // Whether the pointer is on the tip. React reports the pointer arriving on
  // the tip from the same event that ends the element's own pointer leave, and
  // a browser runs it first, so the element's leave comes last: the timer asks
  // where the pointer is, not which of the two came last.
  const onTip = useRef(false);
  const settle = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!onTip.current) setPointer(false);
    }, LEAVE_MS);
  }, []);
  const enterElement = useCallback(() => {
    window.clearTimeout(timer.current);
    onTip.current = false;
    setPointer(true);
  }, []);
  const enterTip = useCallback(() => {
    window.clearTimeout(timer.current);
    onTip.current = true;
    setPointer(true);
  }, []);
  const leaveTip = useCallback(() => {
    onTip.current = false;
    settle();
  }, [settle]);
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    onTip.current = false;
    setPointer(false);
    setFocused(false);
  }, []);
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const arm = () => {
      onArm?.();
      setArmed(true);
    };
    const onEnter = () => {
      arm();
      enterElement();
    };
    const onFocus = () => {
      arm();
      setFocused(true);
    };
    const onBlur = () => {
      setFocused(false);
    };
    const focusIn = holdsFocus ? "focusin" : "focus";
    const focusOut = holdsFocus ? "focusout" : "blur";
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", settle);
    el.addEventListener(focusIn, onFocus);
    el.addEventListener(focusOut, onBlur);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", settle);
      el.removeEventListener(focusIn, onFocus);
      el.removeEventListener(focusOut, onBlur);
      window.clearTimeout(timer.current);
    };
  }, [element, holdsFocus, onArm, enterElement, settle]);
  return {
    armed,
    open: pointer || focused,
    enter: enterTip,
    leave: leaveTip,
    close,
  };
}
