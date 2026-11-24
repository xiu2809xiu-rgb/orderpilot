import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EOI,
  MARKER,
  SOI,
  comment,
  exif,
  flatJpegParts,
  frameWith,
  jfifApp0,
  jpeg,
  makeFlatJpeg,
  markedProgressive,
  segment,
} from "../../../../test/support/flat-jpeg.js";
import { JpegCleaner, type JpegVerdict } from "./jpeg-cleaner.js";

const FIXTURE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../test/fixtures/profile-picture-flat-256.jpg",
  ),
);
const cleaner = new JpegCleaner();
const parts = flatJpegParts();

interface Overrides {
  readonly app0?: Buffer;
  readonly dqt?: Buffer;
  readonly sof?: Buffer;
  readonly dht?: Buffer;
  readonly sos?: Buffer;
  readonly scan?: Buffer;
  readonly before?: Buffer[];
  readonly afterApp0?: Buffer[];
  readonly afterScan?: Buffer[];
}

/** The default file with some pieces replaced and some segments added. */
function build(overrides: Overrides = {}): Buffer {
  const p = { ...parts, ...overrides };
  return jpeg(
    SOI,
    ...(overrides.before ?? []),
    p.app0,
    ...(overrides.afterApp0 ?? []),
    p.dqt,
    p.sof,
    p.dht,
    p.sos,
    p.scan,
    ...(overrides.afterScan ?? []),
    EOI,
  );
}

function refusal(verdict: JpegVerdict): string {
  return verdict.ok ? "accepted" : verdict.code;
}

function isRestart(marker: number): boolean {
  return marker >= 0xd0 && marker <= 0xd7;
}

/** The markers at segment boundaries of a file: the ones a parser would meet. */
function boundaryMarkers(bytes: Buffer): number[] {
  const found: number[] = [];
  let at = 2;
  while (at + 1 < bytes.length) {
    const marker = bytes[at + 1] ?? 0;
    found.push(marker);
    if (marker === MARKER.SOS) {
      let end = at + 2 + bytes.readUInt16BE(at + 2);
      while (end + 1 < bytes.length) {
        const next = bytes[end + 1] ?? 0;
        if (bytes[end] === 0xff && next !== 0x00 && !isRestart(next)) break;
        end += bytes[end] === 0xff ? 2 : 1;
      }
      at = end;
    } else if (marker === 0xd9) {
      break;
    } else {
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  return found;
}

/** A small seeded generator, so the corruptions are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("JpegCleaner accepts", () => {
  it("the 256 px baseline fixture and returns its bytes unchanged", () => {
    const verdict = cleaner.clean(FIXTURE);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(Buffer.compare(verdict.bytes, FIXTURE)).toBe(0);
    expect(verdict).toMatchObject({
      width: 256,
      progressive: false,
      components: 3,
      strippedSegments: 0,
      trailingBytesCut: 0,
    });
  });

  it("a progressive frame and a one-component grey file", () => {
    const progressive = cleaner.clean(markedProgressive(FIXTURE));
    expect(progressive.ok && progressive.progressive).toBe(true);
    const grey = cleaner.clean(makeFlatJpeg({ side: 128, components: 1 }));
    expect(grey.ok && grey.components).toBe(1);
    expect(grey.ok && grey.width).toBe(128);
  });

  it("128 and 512 pixels, the two ends of the range", () => {
    expect(cleaner.clean(makeFlatJpeg({ side: 128 })).ok).toBe(true);
    expect(cleaner.clean(makeFlatJpeg({ side: 512 })).ok).toBe(true);
  });

  it("a restart marker and a stuffed FF 00 inside the data", () => {
    const withRestart = build({
      scan: Buffer.concat([
        parts.scan,
        Buffer.from([0xff, 0xd3, 0xff, 0x00, 0x12]),
      ]),
    });
    const verdict = cleaner.clean(withRestart);
    expect(verdict.ok && Buffer.compare(verdict.bytes, withRestart)).toBe(0);
  });

  it("does not mistake FF C0 inside scan data for a frame", () => {
    // FF 00 C0 is a stuffed byte followed by C0, so no marker is there.
    const input = build({
      scan: Buffer.concat([
        parts.scan,
        Buffer.from([0xff, 0x00, 0xc0, 0x00, 0x11]),
      ]),
    });
    const verdict = cleaner.clean(input);
    expect(verdict.ok && verdict.width).toBe(256);
  });

  it("reads the frame header, not the size of a thumbnail inside APP1", () => {
    const thumbnail = jpeg(SOI, frameWith(50, 50, 3), EOI);
    const holder = segment(
      MARKER.APP1,
      Buffer.concat([Buffer.from("Exif\0\0"), thumbnail]),
    );
    const verdict = cleaner.clean(build({ afterApp0: [holder] }));
    expect(verdict.ok && verdict.width).toBe(256);
    expect(verdict.ok && verdict.bytes.includes(thumbnail)).toBe(false);
  });
});

describe("JpegCleaner removes", () => {
  it("an APP1 holding EXIF with a GPS tag, and a comment: the output holds neither marker nor text", () => {
    const input = build({
      afterApp0: [exif(true), comment("shot at home, 1.30N 103.8E")],
    });
    expect(input.includes("GPSLatitude")).toBe(true);
    const verdict = cleaner.clean(input);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.strippedSegments).toBe(2);
    expect(verdict.bytes.includes("GPS")).toBe(false);
    expect(verdict.bytes.includes("Exif")).toBe(false);
    expect(verdict.bytes.includes("shot at home")).toBe(false);
    expect(Buffer.compare(verdict.bytes, FIXTURE)).toBe(0);
  });

  it("every APPn segment and comment, wherever it sits", () => {
    const many = [0xe1, 0xe2, 0xe3, 0xe8, 0xed, 0xee, 0xef, 0xfe].map(
      (marker) => segment(marker, Buffer.from("payload")),
    );
    const verdict = cleaner.clean(build({ afterApp0: many }));
    expect(verdict.ok && verdict.strippedSegments).toBe(8);
    expect(verdict.ok && Buffer.compare(verdict.bytes, FIXTURE)).toBe(0);
  });

  it("keeps a 16-byte JFIF APP0 and drops a JFXX APP0 and any other APP0", () => {
    const jfxx = segment(MARKER.APP0, Buffer.from("JFXX\0\x10 thumbnail"));
    const other = segment(MARKER.APP0, Buffer.from("anything at all"));
    const longJfif = segment(
      MARKER.APP0,
      Buffer.concat([Buffer.from("JFIF\0"), Buffer.alloc(20)]),
    );
    const none = cleaner.clean(
      build({ app0: Buffer.alloc(0), before: [jfxx, other] }),
    );
    expect(none.ok && none.strippedSegments).toBe(2);
    expect(none.ok && none.bytes.subarray(2, 4).toString("hex")).toBe("ffdb");

    const kept = cleaner.clean(build({ afterApp0: [jfxx, other, longJfif] }));
    expect(kept.ok && kept.strippedSegments).toBe(3);
    expect(kept.ok && Buffer.compare(kept.bytes, FIXTURE)).toBe(0);

    // A second JFIF header is dropped: only the first, right after the start marker, is kept.
    const second = cleaner.clean(build({ afterApp0: [jfifApp0()] }));
    expect(second.ok && second.strippedSegments).toBe(1);
  });

  it("everything after the end marker, and says how many bytes", () => {
    const zip = Buffer.concat([
      Buffer.from("PK\x03\x04"),
      Buffer.alloc(300, 0x41),
    ]);
    const verdict = cleaner.clean(jpeg(FIXTURE, zip));
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.trailingBytesCut).toBe(zip.length);
    expect(verdict.bytes.includes("PK")).toBe(false);
    expect(Buffer.compare(verdict.bytes, FIXTURE)).toBe(0);
  });

  it("fill bytes before a marker", () => {
    const input = jpeg(
      SOI,
      parts.app0,
      Buffer.from([0xff, 0xff, 0xff]),
      parts.dqt,
      parts.sof,
      parts.dht,
      parts.sos,
      parts.scan,
      Buffer.from([0xff, 0xff]),
      EOI,
    );
    const verdict = cleaner.clean(input);
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && Buffer.compare(verdict.bytes, FIXTURE)).toBe(0);
  });
});

describe("JpegCleaner refuses", () => {
  it("empty, one byte, text, a PNG, a GIF and a lone start marker", () => {
    expect(refusal(cleaner.clean(Buffer.alloc(0)))).toBe("empty");
    for (const bytes of [
      Buffer.from([0xff]),
      Buffer.from("hello, this is not a picture"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("GIF89a\x01\x00\x01\x00"),
      SOI,
    ]) {
      expect(refusal(cleaner.clean(bytes))).toBe("not_jpeg");
    }
  });

  it("more than 256 KB", () => {
    expect(refusal(cleaner.clean(Buffer.alloc(262_145, 0xff)))).toBe("too_big");
  });

  it("a file with no end marker and every strict prefix of the fixture", () => {
    expect(
      refusal(cleaner.clean(FIXTURE.subarray(0, FIXTURE.length - 2))),
    ).toBe("damaged");
    for (let length = 4; length < FIXTURE.length; length += 1) {
      expect(refusal(cleaner.clean(FIXTURE.subarray(0, length)))).toBe(
        "damaged",
      );
    }
  });

  it("a segment whose length runs past the end, a length of 0 and a length of 1", () => {
    const past = segment(MARKER.COM, Buffer.from("x"), 9000);
    expect(refusal(cleaner.clean(build({ afterApp0: [past] })))).toBe(
      "damaged",
    );
    for (const length of [0, 1]) {
      const short = segment(MARKER.COM, Buffer.alloc(0), length);
      expect(refusal(cleaner.clean(build({ afterApp0: [short] })))).toBe(
        "damaged",
      );
    }
  });

  it("a frame claiming 50,000 by 50,000 and 65,535 by 65,535 pixels, as the wrong size", () => {
    for (const side of [50_000, 65_535]) {
      expect(
        refusal(cleaner.clean(build({ sof: frameWith(side, side, 3) }))),
      ).toBe("wrong_size");
    }
  });

  it("127 and 513 pixels as the wrong size, and 300 by 200 as not square", () => {
    const sized = (width: number, height: number): string =>
      refusal(cleaner.clean(build({ sof: frameWith(width, height, 3) })));
    expect(sized(127, 127)).toBe("wrong_size");
    expect(sized(513, 513)).toBe("wrong_size");
    expect(sized(300, 200)).toBe("not_square");
    expect(sized(50_000, 300)).toBe("not_square");
  });

  it("height 0, arithmetic, lossless, extended sequential, 12-bit and four-component frames", () => {
    expect(refusal(cleaner.clean(build({ sof: frameWith(256, 0, 3) })))).toBe(
      "unsupported",
    );
    for (const marker of [0xc9, 0xc3, 0xc1, 0xca, 0xc5]) {
      expect(
        refusal(cleaner.clean(build({ sof: frameWith(256, 256, 3, marker) }))),
      ).toBe("unsupported");
    }
    const twelveBit = Buffer.from(frameWith(256, 256, 3));
    twelveBit[4] = 12;
    expect(refusal(cleaner.clean(build({ sof: twelveBit })))).toBe(
      "unsupported",
    );
    expect(refusal(cleaner.clean(build({ sof: frameWith(256, 256, 4) })))).toBe(
      "unsupported",
    );
  });

  it("a frame with the wrong length, or two components with the same id", () => {
    const wrong = Buffer.from(frameWith(256, 256, 3));
    wrong.writeUInt16BE(20, 2);
    expect(refusal(cleaner.clean(build({ sof: wrong })))).toBe("damaged");
    const same = Buffer.from(frameWith(256, 256, 3));
    same[13] = 1;
    expect(refusal(cleaner.clean(build({ sof: same })))).toBe("damaged");
  });

  it("garbage between segments, a second start marker, a second frame and a scan before a frame", () => {
    expect(
      refusal(cleaner.clean(build({ afterApp0: [Buffer.from([0x00])] }))),
    ).toBe("damaged");
    expect(refusal(cleaner.clean(build({ afterApp0: [SOI] })))).toBe("damaged");
    expect(refusal(cleaner.clean(build({ afterApp0: [parts.sof] })))).toBe(
      "damaged",
    );
    const early = jpeg(
      SOI,
      parts.app0,
      parts.dqt,
      parts.dht,
      parts.sos,
      parts.scan,
      parts.sof,
      EOI,
    );
    expect(refusal(cleaner.clean(early))).toBe("damaged");
  });

  it("a file with no scan, and an unstuffed FF C0 in the data", () => {
    const noScan = jpeg(SOI, parts.app0, parts.dqt, parts.sof, parts.dht, EOI);
    expect(refusal(cleaner.clean(noScan))).toBe("damaged");
    const loose = build({
      scan: Buffer.concat([parts.scan, Buffer.from([0xff, 0xc0, 0x00, 0x11])]),
    });
    expect(refusal(cleaner.clean(loose))).toBe("damaged");
  });

  it("a quantisation table of the wrong length and a Huffman table that overfills its code space", () => {
    const shortTable = segment(
      MARKER.DQT,
      Buffer.concat([Buffer.from([0]), Buffer.alloc(63, 1)]),
    );
    expect(refusal(cleaner.clean(build({ dqt: shortTable })))).toBe("damaged");
    // Three codes of length 1 do not fit in one bit.
    const overfull = segment(
      MARKER.DHT,
      Buffer.from([
        0x00, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3,
      ]),
    );
    expect(refusal(cleaner.clean(build({ dht: overfull })))).toBe("damaged");
  });

  it("a scan header that names a component the frame does not have", () => {
    const sos = Buffer.from(parts.sos);
    sos[5] = 9;
    expect(refusal(cleaner.clean(build({ sos })))).toBe("damaged");
  });

  it("a restart interval of the wrong length", () => {
    const interval = segment(MARKER.DRI, Buffer.from([0, 1, 2]));
    expect(refusal(cleaner.clean(build({ afterApp0: [interval] })))).toBe(
      "damaged",
    );
  });

  it("a marker it does not know, such as a reserved one", () => {
    const reserved = segment(0xf5, Buffer.from("x"));
    expect(refusal(cleaner.clean(build({ afterApp0: [reserved] })))).toBe(
      "unsupported",
    );
  });
});

describe("JpegCleaner output", () => {
  it("cleaned again gives the same bytes, for several crafted inputs", () => {
    const inputs = [
      FIXTURE,
      jpeg(FIXTURE, Buffer.from("trailing")),
      build({ afterApp0: [exif(true), comment("c")] }),
      markedProgressive(makeFlatJpeg({ side: 192 })),
      build({
        scan: Buffer.concat([
          parts.scan,
          Buffer.from([0xff, 0xd0, 0xff, 0xff]),
        ]),
      }),
    ];
    for (const input of inputs) {
      const first = cleaner.clean(input);
      expect(first.ok).toBe(true);
      if (!first.ok) continue;
      const second = cleaner.clean(first.bytes);
      expect(second.ok && Buffer.compare(second.bytes, first.bytes)).toBe(0);
    }
  });

  it("never holds an APP1 to APP15 or comment marker at a segment boundary, and is never longer than the input", () => {
    const input = jpeg(
      build({
        afterApp0: [
          exif(true),
          segment(0xe5, Buffer.from("x")),
          comment("hi"),
          segment(MARKER.APP0, Buffer.from("zz")),
        ],
      }),
      Buffer.from("tail"),
    );
    const verdict = cleaner.clean(input);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    const markers = boundaryMarkers(verdict.bytes);
    expect(markers.filter((m) => m >= 0xe1 && m <= 0xef)).toEqual([]);
    expect(markers).not.toContain(MARKER.COM);
    expect(markers.filter((m) => m === MARKER.APP0)).toHaveLength(1);
    expect(verdict.bytes.length).toBeLessThanOrEqual(input.length);
  });

  it("never throws and never reads past the buffer for 200 seeded corruptions of the fixture", () => {
    const random = seeded(20_261_124);
    let accepted = 0;
    for (let round = 0; round < 200; round += 1) {
      const copy = Buffer.from(FIXTURE);
      const flips = 1 + Math.floor(random() * 6);
      for (let i = 0; i < flips; i += 1) {
        copy[Math.floor(random() * 200)] = Math.floor(random() * 256);
      }
      const shape = round % 4;
      let input: Buffer;
      if (shape === 0) {
        input = copy;
      } else if (shape === 1) {
        input = copy.subarray(0, Math.floor(random() * copy.length));
      } else if (shape === 2) {
        input = jpeg(
          copy.subarray(0, 40),
          Buffer.from([0xff, Math.floor(random() * 256)]),
          copy.subarray(40),
        );
      } else {
        input = jpeg(copy, Buffer.alloc(Math.floor(random() * 50), 0xff));
      }
      const verdict = cleaner.clean(input);
      if (verdict.ok) {
        accepted += 1;
        expect(verdict.bytes.length).toBeLessThanOrEqual(input.length);
        const again = cleaner.clean(verdict.bytes);
        expect(again.ok && Buffer.compare(again.bytes, verdict.bytes)).toBe(0);
      } else {
        expect(typeof verdict.code).toBe("string");
      }
    }
    // The corruptions are not all fatal, so the loop covers both answers.
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(200);
  });
});
