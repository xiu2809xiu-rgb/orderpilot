import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";

/** The five faces a layout may use: Geist for the sans looks, PT Serif for the letter. */
export type FontId = "sans" | "sansBold" | "mono" | "serif" | "serifBold";

const FILES: Readonly<Record<FontId, string>> = {
  sans: "Geist-Regular.ttf",
  sansBold: "Geist-SemiBold.ttf",
  mono: "GeistMono-Regular.ttf",
  serif: "PTSerif-Regular.ttf",
  serifBold: "PTSerif-Bold.ttf",
};

export type Face = ReturnType<typeof fontkit.create>;

export interface LoadedFont {
  readonly id: FontId;
  /** The file's bytes, which the PDF embeds as a subset. */
  readonly bytes: Uint8Array;
  readonly face: Face;
}

const cache = new Map<FontId, LoadedFont>();

/** Fonts ship in the package, so a render never depends on what the machine has installed. */
export function loadFont(id: FontId): LoadedFont {
  let loaded = cache.get(id);
  if (!loaded) {
    const path = fileURLToPath(
      new URL(`../fonts/${FILES[id]}`, import.meta.url),
    );
    const bytes = new Uint8Array(readFileSync(path));
    loaded = { id, bytes, face: fontkit.create(bytes) };
    cache.set(id, loaded);
  }
  return loaded;
}

const laid = new Map<string, ReturnType<typeof shape>>();

function shape(id: FontId, text: string) {
  const { face } = loadFont(id);
  const { glyphs } = face.layout(text);
  let advance = 0;
  const placed = glyphs.map((glyph) => {
    const at = advance;
    advance += glyph.advanceWidth / face.unitsPerEm;
    return { glyph, at };
  });
  return { placed, advance };
}

/**
 * The glyphs of a string and where each one starts, in ems. Advances only: the
 * PDF writer places glyphs the same way (no kerning), so what is measured here
 * is what lands on the page. Remembered, because a table repeats the same
 * words and a text is measured again for its width and its ink.
 */
export function layoutText(id: FontId, text: string) {
  const key = `${id}\u0000${text}`;
  let found = laid.get(key);
  if (!found) {
    found = shape(id, text);
    laid.set(key, found);
  }
  return found;
}

/** The width of a string in points. */
export function textWidth(id: FontId, text: string, size: number): number {
  return layoutText(id, text).advance * size;
}

export interface InkExtent {
  /** Points the ink rises above the baseline, and falls below it. */
  rise: number;
  fall: number;
}

/** The ink's height from the glyph outlines, so a box can sit tight around the text. */
export function inkExtent(id: FontId, text: string, size: number): InkExtent {
  const { face } = loadFont(id);
  const { placed } = layoutText(id, text);
  const scale = size / face.unitsPerEm;
  let top = 0;
  let bottom = 0;
  for (const { glyph } of placed) {
    const box = glyph.bbox;
    if (glyph.advanceWidth === 0 || box.maxY === box.minY) continue;
    top = Math.max(top, box.maxY);
    bottom = Math.min(bottom, box.minY);
  }
  return { rise: top * scale, fall: -bottom * scale };
}
