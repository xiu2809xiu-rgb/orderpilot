import { createHash } from "node:crypto";

/** The same JSON whatever order its keys were written in. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        // By character code, not locale, so a hash kept today matches one made after an upgrade.
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, inner]) => [key, canonical(inner)]),
    );
  }
  return value;
}

/**
 * What identifies a request for its idempotency key: the command, what it acts
 * on and its body. A repeat must match it exactly to be given the kept answer.
 */
export function requestHashOf(
  command: string,
  target: string,
  body: unknown,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical({ command, target, body })))
    .digest("hex");
}
