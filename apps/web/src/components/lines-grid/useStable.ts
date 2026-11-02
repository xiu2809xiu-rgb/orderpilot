import { useState } from "react";

/**
 * The same object for as long as its content is the same, so that a screen can
 * write `columns={[...]}` inline without every line re-rendering with it.
 */
export function useStable<T>(value: T): T {
  const [kept, setKept] = useState(value);
  if (JSON.stringify(kept) !== JSON.stringify(value)) {
    setKept(value);
    return value;
  }
  return kept;
}
