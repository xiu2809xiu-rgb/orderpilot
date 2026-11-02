import type { FieldErrors, FieldValues } from "react-hook-form";

export interface ErrorLeaf {
  path: string;
  type: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NOT_PATHS = ["ref", "message", "type", "types"];

/**
 * Every message in React Hook Form's nested error tree, with the dotted path it
 * sits at. A list's own error (`lines` needing a row) is a leaf at `lines`.
 */
export function errorLeaves<T extends FieldValues>(
  errors: FieldErrors<T>,
): ErrorLeaf[] {
  return walk(errors, []);
}

function walk(node: unknown, path: string[]): ErrorLeaf[] {
  if (!isRecord(node)) return [];
  const own =
    typeof node.message === "string" && node.message !== "" && path.length > 0
      ? [
          {
            path: path.join("."),
            type: typeof node.type === "string" ? node.type : "",
            message: node.message,
          },
        ]
      : [];
  const inner = Object.entries(node).flatMap(([key, child]) =>
    NOT_PATHS.includes(key) ? [] : walk(child, [...path, key]),
  );
  return [...own, ...inner];
}
