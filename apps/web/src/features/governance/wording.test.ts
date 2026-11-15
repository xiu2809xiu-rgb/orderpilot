import { describe, expect, it } from "vitest";
import audit from "@/locales/en/audit.json";
import governance from "@/locales/en/governance.json";
import monitoring from "@/locales/en/monitoring.json";

/** Every string in a locale file, with the key it sits under. */
function strings(tree: unknown, at = ""): [string, string][] {
  if (typeof tree === "string") return [[at, tree]];
  if (tree === null || typeof tree !== "object") return [];
  return Object.entries(tree).flatMap(([key, value]) =>
    strings(value, at ? `${at}.${key}` : key),
  );
}

describe("Area 4's wording", () => {
  it.each([
    ["audit", audit],
    ["governance", governance],
    ["monitoring", monitoring],
  ])("spells trace ID as the rest of the app does, in %s.json", (_, file) => {
    // "trace id" or "Trace id": the rest of the app writes ID in capitals.
    const odd = strings(file).filter(([, text]) =>
      /\b[tT]race id\b/.test(text),
    );
    expect(odd.map(([key]) => key)).toEqual([]);
  });
});
