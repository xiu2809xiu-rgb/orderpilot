import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../kit/env";

export type SparkKind = "stock" | "trend" | "other";
export type TurnPhase = "thinking" | "streaming" | "done" | "stopped";

export interface Turn {
  id: number;
  question: string;
  kind: SparkKind;
  phase: TurnPhase;
  /** How long the looking-up took, in seconds, once it is over. */
  seconds: number | null;
}

/** How long Spark "looks things up" before it starts to answer. */
export const THINK_MS = 1500;
/** Under reduced motion the pause is short and the answer arrives whole. */
export const THINK_MS_STILL = 250;

/**
 * Which scripted answer a typed question gets. The two suggested questions are
 * sent with their kind; anything typed is matched on a word, and anything else
 * gets the honest answer that Spark only knows two things in this preview.
 */
export function classify(question: string, mayReadSales: boolean): SparkKind {
  const text = question.toLowerCase();
  if (/\b(monitors?|stock|hp)\b/.test(text)) return "stock";
  if (mayReadSales && /\b(sales|trend|forecast|revenue)\b/.test(text)) {
    return "trend";
  }
  return "other";
}

/**
 * The conversation of the Spark panel. Every answer is scripted: a turn thinks
 * for a moment, then streams (the turn's own component reveals the words and
 * calls `finish`), then is done. Only one turn works at a time; `stop` ends it
 * where it is.
 */
export function useSparkChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const next = useRef(1);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const update = (id: number, change: Partial<Turn>) => {
    setTurns((all) =>
      all.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)),
    );
  };

  const send = useCallback((question: string, kind: SparkKind) => {
    const id = next.current;
    next.current += 1;
    started.current = performance.now();
    setTurns((all) => [
      ...all,
      { id, question, kind, phase: "thinking", seconds: null },
    ]);
    clear();
    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        update(id, {
          phase: "streaming",
          seconds: (performance.now() - started.current) / 1000,
        });
      },
      prefersReducedMotion() ? THINK_MS_STILL : THINK_MS,
    );
  }, []);

  const finish = useCallback((id: number) => {
    update(id, { phase: "done" });
  }, []);

  const stop = useCallback(() => {
    clear();
    setTurns((all) =>
      all.map((turn) =>
        turn.phase === "thinking" || turn.phase === "streaming"
          ? {
              ...turn,
              phase: "stopped",
              seconds:
                turn.seconds ?? (performance.now() - started.current) / 1000,
            }
          : turn,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    clear();
    setTurns([]);
  }, []);

  const last = turns[turns.length - 1];
  const busy = last?.phase === "thinking" || last?.phase === "streaming";
  return { turns, busy, send, finish, stop, reset };
}
