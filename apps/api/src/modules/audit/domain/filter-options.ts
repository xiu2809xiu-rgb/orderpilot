/** The name shown for a person the users table does not know. */
export const UNKNOWN_PERSON = "Unknown user";

/** How many sequences either side the events around a sequence take (F-9). */
export const AROUND_RADIUS = 5;

/**
 * The inclusive sequence range around `sequence`. It never starts before the
 * first sequence. A range, not a count: a rolled-back write leaves a gap in
 * the sequence, so a range can hold fewer events than it spans.
 */
export function aroundRange(
  sequence: number,
  radius: number = AROUND_RADIUS,
): { from: number; to: number } {
  return { from: Math.max(1, sequence - radius), to: sequence + radius };
}

/**
 * The people the actor filter offers: each id once, with its name, sorted by
 * name. Only the id and the name leave: the filter shows people by name, never
 * by email. A person with no name is kept, so their events can still be found.
 */
export function peopleFrom(
  ids: readonly string[],
  names: ReadonlyMap<string, string>,
): { id: string; name: string }[] {
  return [...new Set(ids)]
    .map((id) => ({ id, name: names.get(id) ?? UNKNOWN_PERSON }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
