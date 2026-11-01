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

/**
 * True when a stored draft still fits the form: no field the form has lost, and
 * no value of another type. Only own keys count, so a `__proto__` key in storage
 * never reaches the form.
 */
export function fitsShape(template: unknown, value: unknown): boolean {
  if (template === null || template === undefined) return true;
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return false;
    const row: unknown = template[0];
    return (
      template.length === 0 ||
      value.every((item: unknown) => fitsShape(row, item))
    );
  }
  if (isRecord(template)) {
    if (!isRecord(value)) return false;
    return Object.entries(value).every(
      ([key, item]) =>
        Object.hasOwn(template, key) && fitsShape(template[key], item),
    );
  }
  return typeof template === typeof value;
}

/** The draft over the form's own values, so a left-out field keeps its value. */
export function mergeDraft(base: unknown, draft: unknown): unknown {
  if (Array.isArray(draft)) {
    return draft.map((item: unknown, index) =>
      mergeDraft(
        Array.isArray(base) ? (base[index] as unknown) : undefined,
        item,
      ),
    );
  }
  if (!isRecord(draft)) return draft;
  const from = isRecord(base) ? base : {};
  return {
    ...from,
    ...Object.fromEntries(
      Object.entries(draft).map(([key, item]) => [
        key,
        mergeDraft(from[key], item),
      ]),
    ),
  };
}
