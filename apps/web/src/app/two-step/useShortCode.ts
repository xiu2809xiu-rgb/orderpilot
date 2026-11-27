import { useId, useRef, useState } from "react";

/**
 * "Verify" with fewer than six digits: the person is told so at the field,
 * and focus goes there. It is not a server answer, so it has no alert and no
 * trace id. The note is tied to the field by `noteId`, and goes at the next
 * change of the digits.
 */
export function useShortCode() {
  const input = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const [short, setShort] = useState(false);
  return {
    /** Passed to the code field, so the note can move focus into it. */
    inputRef: input,
    noteId,
    short,
    /** The ids that describe the field: this note when it shows, then the others. */
    describedBy: (...others: (string | undefined)[]): string | undefined =>
      [short ? noteId : undefined, ...others].filter(Boolean).join(" ") ||
      undefined,
    show: () => {
      setShort(true);
      input.current?.focus({ preventScroll: true });
    },
    clear: () => {
      setShort(false);
    },
  };
}
