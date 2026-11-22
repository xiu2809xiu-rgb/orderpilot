export type ShortcutId =
  | "palette"
  | "spark"
  | "close"
  | "undo"
  | "search"
  | "new"
  | "save"
  | "confirm";

export interface Shortcut {
  id: ShortcutId;
  /** `KeyboardEvent.key`, lower case for a letter. */
  key: string;
  /** Held with Ctrl, or Command on a Mac: every handler takes either. */
  mod: boolean;
  group: "everywhere" | "lists";
  /** Listed in the small Help panel as well as on the Settings page. */
  quick: boolean;
  /** Only where Spark exists for the signed-in role. */
  needs?: "spark";
  /** The line of small print under it has its own text. */
  hasNote: boolean;
}

/**
 * The keys the app answers to. The handlers read their key from here and the
 * Help panel and Settings draw their lists from here, so the three cannot say
 * different things. Esc is answered by the dialogs and menus themselves (Radix);
 * it is listed here so that people can find it.
 */
export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "palette",
    key: "k",
    mod: true,
    group: "everywhere",
    quick: true,
    hasNote: false,
  },
  {
    id: "spark",
    key: ".",
    mod: true,
    group: "everywhere",
    quick: true,
    needs: "spark",
    hasNote: false,
  },
  {
    id: "close",
    key: "Escape",
    mod: false,
    group: "everywhere",
    quick: true,
    hasNote: false,
  },
  {
    id: "undo",
    key: "z",
    mod: true,
    group: "everywhere",
    quick: false,
    hasNote: false,
  },
  {
    id: "search",
    key: "/",
    mod: false,
    group: "lists",
    quick: true,
    hasNote: true,
  },
  {
    id: "new",
    key: "n",
    mod: false,
    group: "lists",
    quick: true,
    hasNote: true,
  },
  {
    id: "save",
    key: "s",
    mod: true,
    group: "lists",
    quick: false,
    hasNote: false,
  },
  {
    id: "confirm",
    key: "Enter",
    mod: true,
    group: "lists",
    quick: false,
    hasNote: false,
  },
];

export function shortcut(id: ShortcutId): Shortcut {
  const found = SHORTCUTS.find((entry) => entry.id === id);
  if (!found) throw new Error(`No shortcut ${id}`);
  return found;
}

/**
 * Whether a key press is this shortcut. A shortcut with Ctrl also takes
 * Command, and never Alt; one without takes neither. Shift is left to the
 * handler, because a few refuse it and the letter keys do not.
 */
export function matchesShortcut(
  entry: Shortcut,
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
): boolean {
  if (event.altKey) return false;
  const modHeld = event.ctrlKey || event.metaKey;
  if (modHeld !== entry.mod) return false;
  return event.key.toLowerCase() === entry.key.toLowerCase();
}

/** "Cmd" on a Mac and "Ctrl" elsewhere. Every handler takes either, so this is only what to show. */
export function modLabel(platform = navigator.platform): "Cmd" | "Ctrl" {
  return /^(Mac|iPhone|iPad|iPod)/i.test(platform) ? "Cmd" : "Ctrl";
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  Escape: "Esc",
};

/** The parts of the key to draw, one `kbd` each: ["Ctrl", "K"]. */
export function keyParts(entry: Shortcut, platform?: string): string[] {
  const key =
    KEY_LABELS[entry.key] ??
    (entry.key.length === 1 ? entry.key.toUpperCase() : entry.key);
  return entry.mod ? [modLabel(platform), key] : [key];
}
