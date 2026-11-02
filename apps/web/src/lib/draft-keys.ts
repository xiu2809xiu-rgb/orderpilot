// Kept apart from the draft store so that signing out does not pull the store,
// and its schema, into the first page load.
export const DRAFT_PREFIX = "op.draft";

/** The viewer's id is in the key, so one person never reads another's draft. */
export function draftKey(viewerId: string, key: string): string {
  return `${DRAFT_PREFIX}.${viewerId}.${key}`;
}

function keysOf(prefix: string): string[] {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith(prefix));
  } catch {
    return [];
  }
}

/** Every stored draft key, whoever's it is. */
export function keysOfAll(): string[] {
  return keysOf(`${DRAFT_PREFIX}.`);
}

/** An explicit sign-out: the person is done, so nothing of theirs stays here. */
export function removeDraftsOf(viewerId: string): void {
  for (const key of keysOf(`${DRAFT_PREFIX}.${viewerId}.`)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Blocked storage holds no draft to remove.
    }
  }
}
