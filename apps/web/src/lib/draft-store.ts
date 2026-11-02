import { z } from "zod";
import { DRAFT_PREFIX as PREFIX, keysOfAll } from "./draft-keys";

export { draftKey, removeDraftsOf } from "./draft-keys";

/** A draft older than this is dropped: the record has likely moved on. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const draftSchema = z.object({
  version: z.number(),
  savedAt: z.iso.datetime(),
  values: z.record(z.string(), z.unknown()),
});
export type StoredDraft = z.infer<typeof draftSchema>;

function parse(raw: string | null): StoredDraft | null {
  if (raw === null) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function isFresh(draft: StoredDraft, now: number): boolean {
  return now - Date.parse(draft.savedAt) <= DRAFT_MAX_AGE_MS;
}

export function removeDraft(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Private windows and blocked storage throw. The form works without it.
  }
}

/** The draft, or null. A broken, stale or older-version draft is dropped. */
export function readDraft(
  storageKey: string,
  version: number,
  now = Date.now(),
): StoredDraft | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const draft = parse(raw);
  if (draft?.version === version && isFresh(draft, now)) return draft;
  removeDraft(storageKey);
  return null;
}

export function writeDraft(storageKey: string, draft: StoredDraft): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Storage is full or blocked: the page still has the values.
  }
}

/** False in a private window or with blocked storage, where no draft can be kept. */
export function storageWorks(): boolean {
  try {
    const probe = `${PREFIX}.probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drafts of forms never opened again would otherwise stay for good. It looks at
 * everyone's, since a shared machine keeps the drafts of people who never came back.
 */
export function removeStaleDrafts(now = Date.now()): void {
  for (const key of keysOfAll()) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return;
    }
    const draft = parse(raw);
    if (!draft || !isFresh(draft, now)) removeDraft(key);
  }
}
