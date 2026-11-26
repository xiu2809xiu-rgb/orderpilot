import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = import.meta.dirname;
const locale = (file: string): unknown =>
  JSON.parse(
    readFileSync(path.join(here, "../locales/en", file), "utf8"),
  ) as unknown;

/** Every string under a key, with the dotted path that reaches it. */
function strings(node: unknown, at: string): [string, string][] {
  if (typeof node === "string") return [[at, node]];
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, child]) =>
    strings(child, `${at}.${key}`),
  );
}

function section(root: unknown, ...keys: string[]): unknown {
  let node = root;
  for (const key of keys) {
    if (typeof node !== "object" || node === null) return undefined;
    node = Object.entries(node).find(([name]) => name === key)?.[1];
  }
  return node;
}

const common = strings(
  section(locale("common.json"), "availability"),
  "common.availability",
);
const settings = strings(
  section(locale("settings.json"), "account", "availability"),
  "settings.account.availability",
);
const all = [...common, ...settings];

// Outside demo mode no screen shows another person's availability until the
// follow-up stories land, so no string may say that someone else can see it. The
// two demo-only sentences are drawn only when the session is a demo (the row's
// own test proves it).
const DEMO_ONLY = new Set([
  "settings.account.availability.demoShared",
  "settings.account.availability.demoSeen",
]);
const SAYS_OTHERS_SEE =
  /colleagues?|everyone|others\b|other accounts|people can|can see it/i;

describe("the words of availability", () => {
  it("has strings for both namespaces", () => {
    expect(common.length).toBeGreaterThan(8);
    expect(settings.length).toBeGreaterThan(8);
  });

  it("says that others can see it only in the two sentences a demo session shows", () => {
    const found = all
      .filter(([, text]) => SAYS_OTHERS_SEE.test(text))
      .map(([key]) => key);
    expect(found.sort()).toEqual([...DEMO_ONLY].sort());
  });

  it("never says status, online or away: OrderPilot cannot know that, and status means an order's", () => {
    const found = all.filter(([, text]) =>
      /\bstatus\b|\bonline\b|\baway\b/i.test(text),
    );
    expect(found).toEqual([]);
  });

  it("holds no em dash", () => {
    expect(
      all.filter(([, text]) => text.includes(String.fromCharCode(0x2014))),
    ).toEqual([]);
  });

  it("says that reminders and approvals still reach the person wherever it says how long a choice lasts", () => {
    const set = all.filter(([key]) =>
      /availability\.set\.(FOCUSING|DO_NOT_DISTURB)$/.test(key),
    );
    expect(set).toHaveLength(2);
    for (const [, text] of set) {
      expect(text).toContain("{{hours}}");
      expect(text).toMatch(/Reminders and approvals still reach you/);
    }
  });
});
