/** Where `useTablePrefs` keeps a table's columns, their order and its saved views. */
export const TABLE_PREFS_PREFIX = "op.table.";

export type SavedPrefs = readonly (readonly [key: string, value: string])[];

/**
 * Forgets the saved table layouts of one signed-in person on this device
 * (`op.table.<table>.<person>`). Another person who uses the same browser
 * keeps theirs. Returns what it removed, so that a toast can offer Undo.
 * Nothing else in storage is touched.
 */
export function clearTablePrefs(viewerId: string): SavedPrefs {
  const removed: [string, string][] = [];
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(TABLE_PREFS_PREFIX) && key.endsWith(`.${viewerId}`)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      removed.push([key, value]);
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be blocked: then nothing was saved here to forget.
  }
  return removed;
}

/** Puts back what `clearTablePrefs` removed. */
export function restoreTablePrefs(saved: SavedPrefs): void {
  try {
    for (const [key, value] of saved) window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked: the layouts then stay forgotten.
  }
}
