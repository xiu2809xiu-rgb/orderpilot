import { useCallback, useEffect, useRef, useState } from "react";
import { codeFieldMotion } from "@/components/kit/code-field/codeFieldMotion";
import type { CodeFieldState } from "@/components/kit/code-field/useCodeField";

/** What to do with a failed try: draw it as a wrong code, or just report it. */
export type FailureKind = "wrong" | "plain";

interface Options<T> {
  /** Sends the code. It resolves with the answer or rejects with the failure. */
  submit: (code: string) => Promise<T>;
  /** The green hold is over: use the answer. */
  onDone: (answer: T) => void;
  /** A try failed. The return value says whether the field shakes and clears. */
  onFail: (error: unknown) => FailureKind;
}

export interface CodeAttempt {
  value: string;
  setValue: (value: string) => void;
  state: CodeFieldState;
  /** True from the submit, through "Verifying" and the green hold; false once an error is drawn. */
  busy: boolean;
  run: (code: string) => void;
  /** Back to an empty field, with no timer left. */
  reset: () => void;
}

const { verifyingMinMs, errorHoldMs, successHoldMs } = codeFieldMotion;

/**
 * Owns the three holds the field does not time itself: "Verifying" for at
 * least 500 ms, red for 900 ms and then a cleared value, green for 700 ms and
 * then `onDone`. Timers are the authority, not `animationend`, because under
 * reduced motion and in jsdom no animation runs. Every timer is cleared on
 * unmount and the ids live in refs, so StrictMode's double mount is safe. A
 * try that finishes after a newer one began, or after unmount, is ignored.
 */
export function useCodeAttempt<T>(options: Options<T>): CodeAttempt {
  const [value, setValue] = useState("");
  const [state, setState] = useState<CodeFieldState>("input");
  const [busy, setBusy] = useState(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const generation = useRef(0);
  const latest = useRef(options);
  latest.current = options;

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => {
      clearTimeout(id);
    });
    timers.current.clear();
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      clearTimers();
    },
    [clearTimers],
  );

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timers.current.delete(id);
          resolve();
        }, ms);
        timers.current.add(id);
      }),
    [],
  );

  const run = useCallback(
    (code: string) => {
      generation.current += 1;
      const mine = generation.current;
      clearTimers();
      setBusy(true);
      setState("verifying");
      const floor = wait(verifyingMinMs);
      latest.current.submit(code).then(
        async (answer) => {
          await floor;
          if (generation.current !== mine) return;
          setState("success");
          await wait(successHoldMs);
          if (generation.current !== mine) return;
          latest.current.onDone(answer);
        },
        async (error: unknown) => {
          await floor;
          if (generation.current !== mine) return;
          const kind = latest.current.onFail(error);
          setBusy(false);
          if (kind === "plain") {
            setState("input");
            return;
          }
          setState("error");
          await wait(errorHoldMs);
          if (generation.current !== mine) return;
          setValue("");
          setState("input");
        },
      );
    },
    [clearTimers, wait],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    clearTimers();
    setValue("");
    setState("input");
    setBusy(false);
  }, [clearTimers]);

  return { value, setValue, state, busy, run, reset };
}
