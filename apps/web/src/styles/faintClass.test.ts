import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Tailwind builds text-faint-foreground only from a theme colour of that name.
// The theme sheet is read as text, as ScrollRegion.css.test.ts reads its sheet,
// because the test runner does not run Tailwind.
const css = readFileSync(path.join(import.meta.dirname, "index.css"), "utf8");
const lines = css.split("\n").map((line) => line.trim());

describe("the faint text tier as a Tailwind class", () => {
  it("maps --color-faint-foreground to the --faint-foreground token, so text-faint-foreground exists", () => {
    expect(lines).toContain(
      "--color-faint-foreground: var(--faint-foreground);",
    );
  });

  it("sits next to the muted mapping, so the two tiers are read together", () => {
    const muted = lines.indexOf(
      "--color-muted-foreground: var(--muted-foreground);",
    );
    expect(muted).toBeGreaterThanOrEqual(0);
    expect(lines[muted + 1]).toBe(
      "--color-faint-foreground: var(--faint-foreground);",
    );
  });
});
