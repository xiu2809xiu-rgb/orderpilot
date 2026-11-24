import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrast,
  flatten,
  parseColor,
  surface,
  type Rgba,
  type Tokens,
} from "@/styles/contrast";
import { must } from "@/test/must";

// The edge mark (ScrollRegion.css) is drawn over table text at the edge of a
// scroll box. This reads its two colours from the style sheet and the theme
// from the token file, blends the mark's strongest point over each card it can
// sit on, and keeps the text readable there, in light and in dark.

const here = import.meta.dirname;
const css = readFileSync(path.join(here, "ScrollRegion.css"), "utf8");
const tokenFile = readFileSync(
  path.join(here, "..", "..", "styles", "tokens.css"),
  "utf8",
);

/** The custom properties declared in one selector's block. */
function block(source: string, selector: string): Tokens {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf("\n}", start + 1));
  const out: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
  }
  return out;
}

const light: Tokens = block(tokenFile, ":root");
const dark: Tokens = { ...light, ...block(tokenFile, ".dark") };

/** The mark's colour at the edge, where it is strongest: a token at a share of its alpha. */
function markAtEdge(declared: string | undefined, tokens: Tokens): Rgba {
  const m =
    /^color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, transparent\)$/.exec(
      declared ?? "",
    );
  if (!m) {
    throw new Error(
      `--sr-edge is not a token mixed with transparent: ${declared ?? "missing"}`,
    );
  }
  const token = parseColor(must(tokens[must(m[1])]));
  return { ...token, a: token.a * (Number(m[2]) / 100) };
}

const SCHEMES = [
  { name: "light", tokens: light, edge: block(css, ".sr-region")["sr-edge"] },
  {
    name: "dark",
    tokens: dark,
    edge: block(css, ".dark .sr-region")["sr-edge"],
  },
] as const;

// A region that holds a table sits on the work card (panel-strong): every
// card that holds a table is made one (surfaces.css). Any other card is the
// plain glass, which carries the two stronger text colours only: the faint
// tier is for small print on the work card.
const ON_WORK_CARD = [
  "foreground",
  "muted-foreground",
  "faint-foreground",
] as const;
const ON_PLAIN_CARD = ["foreground", "muted-foreground"] as const;
const CARDS = [
  { card: "panel-strong", texts: ON_WORK_CARD },
  { card: "card", texts: ON_PLAIN_CARD },
] as const;

describe.each(SCHEMES)("the edge mark in $name", ({ tokens, edge }) => {
  const mark = markAtEdge(edge, tokens);

  it.each(CARDS)(
    "keeps its text colours at 4.5:1 under the mark on the $card",
    ({ card, texts }) => {
      const under = surface(tokens, [card]);
      const marked = flatten(mark, under);
      for (const text of texts) {
        expect(
          contrast(parseColor(must(tokens[text])), marked),
          `${text} under the mark on ${card}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(CARDS)(
    "stays visible against the $card: 1.1:1 or more at the edge",
    ({ card }) => {
      const under = surface(tokens, [card]);
      expect(contrast(flatten(mark, under), under)).toBeGreaterThanOrEqual(1.1);
    },
  );
});

describe("the style sheet", () => {
  it("gives the mark a value for light and a value for dark", () => {
    expect(block(css, ".sr-region")["sr-edge"]).toBeDefined();
    expect(block(css, ".dark .sr-region")["sr-edge"]).toBeDefined();
  });
});
