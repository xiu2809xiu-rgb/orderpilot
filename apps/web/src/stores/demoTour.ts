import { roleSchema } from "@orderpilot/shared";
import { z } from "zod";
import { create } from "zustand";

/** Something the tour did that its last step puts back. */
const undoSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("task"), role: roleSchema, taskId: z.string() }),
  z.object({ kind: z.literal("spr"), recordNo: z.string() }),
  z.object({ kind: z.literal("payment"), orderNo: z.string() }),
]);
export type TourUndo = z.infer<typeof undoSchema>;

const savedSchema = z.object({
  step: z.number().int().min(0),
  undo: z.array(undoSchema),
});

const KEY = "op.demo-tour";

interface DemoTourState {
  /** The step the tour is on, or null when no tour runs. */
  step: number | null;
  undo: TourUndo[];
  start: () => void;
  goTo: (step: number) => void;
  remember: (entry: TourUndo) => void;
  /** Drops entries that have been put back. */
  forget: (entries: readonly TourUndo[]) => void;
  stop: () => void;
}

/** Storage can be edited or blocked: a bad or missing entry means no tour. */
function load(): Pick<DemoTourState, "step" | "undo"> {
  try {
    const raw = sessionStorage.getItem(KEY);
    const saved = raw ? savedSchema.safeParse(JSON.parse(raw)) : null;
    if (saved?.success) return saved.data;
  } catch {
    // Unreadable storage: start without a tour.
  }
  return { step: null, undo: [] };
}

function save(step: number | null, undo: TourUndo[]): void {
  try {
    if (step === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify({ step, undo }));
  } catch {
    // The tour still runs; only a reload in the middle of it forgets its place.
  }
}

/**
 * The demo tour's place and what it must undo, kept for the browser tab, so a
 * reload in the middle of a demo carries on where it was.
 */
export const useDemoTour = create<DemoTourState>((set, get) => ({
  ...load(),
  start: () => {
    save(0, []);
    set({ step: 0, undo: [] });
  },
  goTo: (step) => {
    save(step, get().undo);
    set({ step });
  },
  remember: (entry) => {
    const undo = [...get().undo, entry];
    save(get().step, undo);
    set({ undo });
  },
  forget: (entries) => {
    const undo = get().undo.filter((entry) => !entries.includes(entry));
    save(get().step, undo);
    set({ undo });
  },
  stop: () => {
    save(null, []);
    set({ step: null, undo: [] });
  },
}));
