function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitPath(value: unknown, path: readonly string[]): unknown {
  const [head, ...rest] = path;
  if (head === undefined) return value;
  if (Array.isArray(value)) {
    if (head !== "*") {
      return value.map((item, index) =>
        String(index) === head ? omitPath(item, rest) : (item as unknown),
      );
    }
    return rest.length === 0
      ? []
      : value.map((item: unknown) => omitPath(item, rest));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (key !== head) return [[key, item]];
      return rest.length === 0 ? [] : [[key, omitPath(item, rest)]];
    }),
  );
}

/**
 * A copy of `values` without the named fields. A path is dotted, and `*` stands
 * for every row of an array: "lines.*.unitPrice".
 */
export function omitPaths(values: unknown, paths: readonly string[]): unknown {
  return paths.reduce<unknown>(
    (kept, path) => omitPath(kept, path.split(".")),
    values,
  );
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * True when a stored draft can be shown by the form: nothing of another type
 * where the form holds text, a record or a list. It is lenient on purpose. A
 * null fits anywhere, since clearing a filled lookup or adding a row with no
 * item yet is ordinary editing, and a field the defaults do not name fits too,
 * since a record may leave optional fields out, as long as it names at least one
 * the form has. A change to the form's fields is what `version` is for. Keys that could reach a prototype never fit.
 */
export function fitsShape(template: unknown, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (template === null || template === undefined) return true;
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return false;
    const row: unknown = template[0];
    return value.every((item: unknown) => fitsShape(row, item));
  }
  if (isRecord(template)) {
    if (!isRecord(value)) return false;
    const entries = Object.entries(value);
    // A record that names nothing the form has belongs to some other form.
    const knowsOne = entries.some(([key]) => Object.hasOwn(template, key));
    if (entries.length > 0 && Object.keys(template).length > 0 && !knowsOne) {
      return false;
    }
    return entries.every(
      ([key, item]) =>
        !UNSAFE_KEYS.has(key) &&
        (!Object.hasOwn(template, key) || fitsShape(template[key], item)),
    );
  }
  return typeof template === typeof value;
}

function rowOf(base: unknown, draftRow: unknown, rowKey: string): unknown {
  if (!Array.isArray(base) || !isRecord(draftRow)) return undefined;
  const id = draftRow[rowKey];
  if (id === undefined) return undefined;
  return base.find((row: unknown) => isRecord(row) && row[rowKey] === id);
}

/**
 * The draft over the form's own values, so a field left out of the draft keeps
 * its value. Rows are matched on their `rowKey` field and never by position:
 * after a deleted line, position would hand one line another line's price. A
 * row with no match comes back without its left-out fields, for the person to
 * enter again.
 */
export function mergeDraft(
  base: unknown,
  draft: unknown,
  rowKey = "id",
): unknown {
  if (Array.isArray(draft)) {
    return draft.map((item: unknown) =>
      mergeDraft(rowOf(base, item, rowKey), item, rowKey),
    );
  }
  if (!isRecord(draft)) return draft;
  const from = isRecord(base) ? base : {};
  return {
    ...from,
    ...Object.fromEntries(
      Object.entries(draft)
        .filter(([key]) => !UNSAFE_KEYS.has(key))
        .map(([key, item]) => [key, mergeDraft(from[key], item, rowKey)]),
    ),
  };
}
