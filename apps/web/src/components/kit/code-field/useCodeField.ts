import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import { prefersReducedMotion } from "../env";
import { activeCell, cellAtPoint, sanitizeDigits } from "./digits";

export type CodeFieldState = "input" | "verifying" | "error" | "success";

interface Options {
  value: string;
  state: CodeFieldState;
  disabled: boolean;
  focusOnMount: boolean;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

/** Hands one node to a callback ref or a ref object. */
function assign<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

/**
 * What the field does with the one real input under the drawn cells: it keeps
 * digits, tells the parent, follows the caret to find the active cell, and
 * keeps focus where a person left it. It knows no server and keeps no timer:
 * the parent owns every phase.
 */
export function useCodeField({
  value,
  state,
  disabled,
  focusOnMount,
  onChange,
  onComplete,
  inputRef,
}: Options) {
  const input = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(Math.min(value.length, 5));
  // The unfold runs once, on mount, and never again after a wrong code.
  const [intro, setIntro] = useState(() => !prefersReducedMotion());
  const editable = state === "input" && !disabled;

  const setNode = useCallback(
    (node: HTMLInputElement | null) => {
      input.current = node;
      assign(inputRef, node);
    },
    [inputRef],
  );

  useEffect(() => {
    if (focusOnMount) input.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  // Back to typing after a wrong code or a failed try: put the caret back,
  // unless the person has moved on to something else on the page.
  const previous = useRef(state);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state !== "input") setIntro(false);
    if (was === "input" || state !== "input") return;
    const node = input.current;
    const here = document.activeElement;
    if (node && (here === null || here === document.body || here === node)) {
      node.focus({ preventScroll: true });
    }
  }, [state]);

  // A value set from outside (cleared after an error) moves the ring back.
  useEffect(() => {
    setActive((cell) => Math.min(cell, value.length, 5));
  }, [value]);

  const receive = (raw: string, caret: number | null) => {
    const next = sanitizeDigits(raw);
    setActive(activeCell(raw, caret));
    if (next === value) return;
    onChange(next);
    if (next.length === 6) onComplete?.(next);
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editable) return;
    const node = event.currentTarget;
    receive(node.value, node.selectionStart);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (!editable) return;
    const pasted = sanitizeDigits(event.clipboardData.getData("text"));
    if (pasted) receive(pasted, pasted.length);
  };

  // Arrow keys, Home and End move the caret and fire no input event.
  const followCaret = () => {
    const node = input.current;
    if (node) setActive(activeCell(node.value, node.selectionStart));
  };

  const onPointerUp = (event: PointerEvent<HTMLInputElement>) => {
    const node = event.currentTarget;
    if (!editable) return;
    const box = node.getBoundingClientRect();
    const cell = cellAtPoint(event.clientX, box.left, box.width, value.length);
    node.setSelectionRange(cell, Math.min(cell + 1, value.length));
    setActive(cell);
  };

  return {
    setNode,
    focused,
    active,
    intro,
    editable,
    endIntro: () => {
      setIntro(false);
    },
    inputProps: {
      onChange: onInput,
      onPaste,
      onPointerUp,
      onKeyUp: followCaret,
      onSelect: followCaret,
      onFocus: () => {
        setFocused(true);
        followCaret();
      },
      onBlur: () => {
        setFocused(false);
      },
    },
  };
}
