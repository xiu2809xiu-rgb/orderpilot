import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AC_COUNTS,
  AC_SYMBOLS,
  DC_COUNTS,
  DC_SYMBOLS,
  MARKER,
  canonicalCodes,
  dcCategory,
  flatJpegParts,
  makeFlatJpeg,
  markedProgressive,
} from "../../../test/support/flat-jpeg.js";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test/fixtures/profile-picture-flat-256.jpg",
);

/** Reads the entropy data bit by bit with the same tables, without decoding a pixel. */
function walkBlocks(scan: Buffer, components: number) {
  const bits: number[] = [];
  for (let i = 0; i < scan.length; i += 1) {
    const byte = scan[i] ?? 0;
    if (i > 0 && scan[i - 1] === 0xff) {
      // The stuffed zero after an FF is not data.
      expect(byte).toBe(0x00);
      continue;
    }
    for (let bit = 7; bit >= 0; bit -= 1) bits.push((byte >> bit) & 1);
  }
  const lookup = (counts: number[], symbols: number[]) => {
    const table = new Map<string, number>();
    for (const [symbol, { code, length }] of canonicalCodes(counts, symbols)) {
      table.set(code.toString(2).padStart(length, "0"), symbol);
    }
    return table;
  };
  const dc = lookup(DC_COUNTS, DC_SYMBOLS);
  const ac = lookup(AC_COUNTS, AC_SYMBOLS);
  let position = 0;
  const readSymbol = (table: Map<string, number>): number => {
    let text = "";
    while (position < bits.length) {
      text += String(bits[position]);
      position += 1;
      const symbol = table.get(text);
      if (symbol !== undefined) return symbol;
      if (text.length > 16) break;
    }
    throw new Error("no code found");
  };
  const readBits = (size: number): number => {
    let value = 0;
    for (let i = 0; i < size; i += 1) {
      value = (value << 1) | (bits[position] ?? 0);
      position += 1;
    }
    return value;
  };
  const differences: number[][] = Array.from({ length: components }, () => []);
  let blocks = 0;
  while (blocks < 100_000) {
    // Padding is only ones, and shorter than a byte.
    if (
      bits.length - position < 8 &&
      bits.slice(position).every((b) => b === 1)
    ) {
      break;
    }
    const component = blocks % components;
    const size = readSymbol(dc);
    let difference = 0;
    if (size > 0) {
      const raw = readBits(size);
      difference = raw >= 1 << (size - 1) ? raw : raw - (1 << size) + 1;
    }
    differences[component]?.push(difference);
    expect(readSymbol(ac)).toBe(0x00);
    blocks += 1;
  }
  return { blocks, differences };
}

describe("the flat JPEG written in code", () => {
  it("is exactly what the generator writes: the checked-in fixture is byte for byte the default output", () => {
    // So nobody replaces the fixture with a photograph without a failing test.
    expect(Buffer.compare(readFileSync(FIXTURE), makeFlatJpeg())).toBe(0);
  });

  it("derives the Annex K.3 DC codes 00, 010, 011, 100 for symbols 0 to 3", () => {
    const codes = canonicalCodes(DC_COUNTS, DC_SYMBOLS);
    const text = (symbol: number): string => {
      const found = codes.get(symbol);
      if (!found) throw new Error("missing");
      return found.code.toString(2).padStart(found.length, "0");
    };
    expect([0, 1, 2, 3].map(text)).toEqual(["00", "010", "011", "100"]);
    expect(canonicalCodes(AC_COUNTS, AC_SYMBOLS).get(0)).toEqual({
      code: 0,
      length: 1,
    });
  });

  it("holds 3,072 blocks, each ending in end-of-block, with every DC difference after the first zero", () => {
    const { scan } = flatJpegParts();
    const { blocks, differences } = walkBlocks(scan, 3);
    expect(blocks).toBe(3 * 32 * 32);
    const [y, cb, cr] = differences;
    // 8 * (value - 128) with the quantiser at 1.
    expect([y?.[0], cb?.[0], cr?.[0]]).toEqual([576, -224, 256]);
    for (const list of differences) {
      expect(list).toHaveLength(1024);
      expect(list.slice(1).every((difference) => difference === 0)).toBe(true);
    }
  });

  it("writes a grey file and a different size without changing the walk", () => {
    const grey = flatJpegParts({ side: 128, components: 1, y: 40 });
    const { blocks, differences } = walkBlocks(grey.scan, 1);
    expect(blocks).toBe(16 * 16);
    expect(differences[0]?.[0]).toBe(8 * (40 - 128));
  });

  it("stuffs a zero after every FF byte of the data and ends with the end marker", () => {
    let sawFf = false;
    for (let y = 0; y < 256; y += 1) {
      const { scan } = flatJpegParts({ side: 8, y, cb: y, cr: y });
      scan.forEach((byte, index) => {
        if (byte !== 0xff) return;
        sawFf = true;
        expect(scan[index + 1]).toBe(0x00);
      });
    }
    // The loop is only a proof if some colour does write an FF.
    expect(sawFf).toBe(true);
    const file = makeFlatJpeg({ side: 128 });
    expect(file.subarray(0, 2).toString("hex")).toBe("ffd8");
    expect(file.subarray(-2).toString("hex")).toBe("ffd9");
    expect(dcCategory(0)).toBe(0);
    expect(dcCategory(-224)).toBe(8);
    expect(dcCategory(576)).toBe(10);
  });

  it("marks a copy progressive by its frame marker alone", () => {
    const original = makeFlatJpeg();
    const marked = markedProgressive(original);
    expect(marked).toHaveLength(original.length);
    const at = original.indexOf(Buffer.from([0xff, MARKER.SOF0]));
    expect(marked[at + 1]).toBe(MARKER.SOF2);
    expect(original[at + 1]).toBe(MARKER.SOF0);
  });
});
