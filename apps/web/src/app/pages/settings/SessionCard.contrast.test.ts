import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrast,
  flatten,
  parseColor,
  surface,
  type Tokens,
} from "@/styles/contrast";
import { must } from "@/test/must";

// Sign out and Reset are drawn in the destructive tokens. Their words must
// stand out of the button's own fill (4.5:1) and of the hover fill, and the
// border out of the card (3:1), in light and in dark. The resting fill is the
// page ground, `background`, in both themes (quietDestructive.ts). Measured on
// the translucent card plus the input wash that the outline variant has in
// dark, the words were 3.75:1.

const tokenFile = readFileSync(
  path.join(import.meta.dirname, "..", "..", "..", "styles", "tokens.css"),
  "utf8",
);

function block(selector: string): Tokens {
  const start = tokenFile.indexOf(`\n${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = tokenFile.slice(start, tokenFile.indexOf("\n}", start + 1));
  const out: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
  }
  return out;
}

const light = block(":root");
const SCHEMES = [
  { name: "light", tokens: light },
  { name: "dark", tokens: { ...light, ...block(".dark") } },
] as const;

describe.each(SCHEMES)("the destructive outline in $name", ({ tokens }) => {
  const ink = parseColor(must(tokens.destructive));

  it("keeps its words at 4.5:1 on the button's own resting fill", () => {
    expect(
      contrast(ink, surface(tokens, ["background"])),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps its border at 3:1 on the card", () => {
    expect(contrast(ink, surface(tokens, ["card"]))).toBeGreaterThanOrEqual(3);
  });

  it("keeps its words at 4.5:1 on the hover fill", () => {
    const fill = flatten(
      parseColor(must(tokens["destructive-surface"])),
      surface(tokens, ["card"]),
    );
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });
});
