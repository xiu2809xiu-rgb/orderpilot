import { PROFILE_PICTURE_LIMITS } from "@orderpilot/shared";

// A JPEG cleaner that rewrites a file from its allowed parts (ADR 0068).
//
// It walks the file segment by segment, using each segment's own length, so a
// picture nested inside an APP1 thumbnail is never mistaken for the frame. It
// keeps only the tables, the frame header and the scans it has checked, writes
// every marker as exactly FF xx, drops every metadata segment (APP1 to APP15,
// comments, and any APP0 that is not a bare JFIF header) and cuts everything
// after the first end marker. It decodes no pixel and allocates nothing from
// a size the file claims. It never repairs: a file that is cut short, or has
// anything between segments, is refused.

export type JpegRefusalCode =
  | "empty"
  | "not_jpeg"
  | "damaged"
  | "unsupported"
  | "not_square"
  | "wrong_size"
  | "too_big";

export type JpegVerdict =
  | {
      readonly ok: true;
      readonly bytes: Buffer;
      /** Pixels on each side, read from the frame header the walk reached. */
      readonly width: number;
      readonly progressive: boolean;
      readonly components: number;
      /** Segments dropped: metadata, and any APP0 that is not a bare JFIF header. */
      readonly strippedSegments: number;
      readonly trailingBytesCut: number;
    }
  | { readonly ok: false; readonly code: JpegRefusalCode };

/** Thrown inside the walk and turned into a refusal at its edge. */
class Refused extends Error {
  constructor(readonly code: JpegRefusalCode) {
    super(code);
    this.name = "Refused";
  }
}

const MAX_SEGMENTS = 2048;
const MAX_SCANS = 64;
const JFIF_IDENTIFIER = [0x4a, 0x46, 0x49, 0x46, 0x00];
const JFIF_APP0_LENGTH = 16;

const M = {
  TEM: 0x01,
  SOF0: 0xc0,
  SOF2: 0xc2,
  DHT: 0xc4,
  RST0: 0xd0,
  RST7: 0xd7,
  SOI: 0xd8,
  EOI: 0xd9,
  SOS: 0xda,
  DQT: 0xdb,
  DRI: 0xdd,
  APP0: 0xe0,
  APP1: 0xe1,
  APP15: 0xef,
  COM: 0xfe,
} as const;

interface Frame {
  readonly width: number;
  readonly progressive: boolean;
  readonly componentIds: readonly number[];
}

/** One walk over one file. */
class Walk {
  private pos = 2;
  private readonly out: Buffer[] = [Buffer.from([0xff, M.SOI])];
  private outLength = 2;
  private frame: Frame | null = null;
  private sawTables = { quantiser: false, huffman: false };
  private jfifKept = false;
  private segments = 0;
  private scans = 0;
  private stripped = 0;

  constructor(private readonly data: Buffer) {}

  run(): JpegVerdict {
    for (;;) {
      const marker = this.nextMarker();
      if (marker === M.EOI) return this.finish();
      this.segment(marker);
    }
  }

  private finish(): JpegVerdict {
    if (this.scans === 0 || this.frame === null) throw new Refused("damaged");
    this.emit(Buffer.from([0xff, M.EOI]));
    return {
      ok: true,
      bytes: Buffer.concat(this.out, this.outLength),
      width: this.frame.width,
      progressive: this.frame.progressive,
      components: this.frame.componentIds.length,
      strippedSegments: this.stripped,
      trailingBytesCut: this.data.length - this.pos,
    };
  }

  /** The marker byte after any run of FF fill bytes. Leaves `pos` after it. */
  private nextMarker(): number {
    const { data } = this;
    if (this.pos >= data.length || data[this.pos] !== 0xff) {
      throw new Refused("damaged");
    }
    while (this.pos < data.length && data[this.pos] === 0xff) this.pos += 1;
    const marker = data[this.pos];
    if (marker === undefined || marker === 0x00) throw new Refused("damaged");
    this.pos += 1;
    return marker;
  }

  private emit(part: Buffer): void {
    this.out.push(part);
    this.outLength += part.length;
  }

  private segment(marker: number): void {
    if (
      marker === M.SOI ||
      marker === M.TEM ||
      (marker >= M.RST0 && marker <= M.RST7)
    ) {
      throw new Refused("damaged");
    }
    const { data } = this;
    if (this.pos + 2 > data.length) throw new Refused("damaged");
    const length = data.readUInt16BE(this.pos);
    if (length < 2 || this.pos + length > data.length) {
      throw new Refused("damaged");
    }
    this.segments += 1;
    if (this.segments > MAX_SEGMENTS) throw new Refused("damaged");
    const payload = data.subarray(this.pos + 2, this.pos + length);
    const end = this.pos + length;
    const whole = Buffer.concat([
      Buffer.from([0xff, marker]),
      data.subarray(this.pos, end),
    ]);

    if (marker === M.APP0) {
      this.appZero(length, payload, whole);
    } else if ((marker >= M.APP1 && marker <= M.APP15) || marker === M.COM) {
      this.stripped += 1;
    } else if (marker === M.DQT) {
      checkQuantiserTables(payload);
      this.sawTables.quantiser = true;
      this.emit(whole);
    } else if (marker === M.DHT) {
      checkHuffmanTables(payload);
      this.sawTables.huffman = true;
      this.emit(whole);
    } else if (marker === M.DRI) {
      if (length !== 4) throw new Refused("damaged");
      this.emit(whole);
    } else if (marker === M.SOF0 || marker === M.SOF2) {
      this.frameHeader(marker, length, payload);
      this.emit(whole);
    } else if (marker === M.SOS) {
      this.pos = end;
      this.scan(whole, payload);
      return;
    } else {
      // Extended, lossless, hierarchical and arithmetic frames, DNL, the
      // reserved markers and anything else.
      throw new Refused("unsupported");
    }
    this.pos = end;
  }

  /** A bare 16-byte JFIF header is what a browser canvas writes. Any other APP0 can hold a thumbnail or anything. */
  private appZero(length: number, payload: Buffer, whole: Buffer): void {
    const bareJfif =
      length === JFIF_APP0_LENGTH &&
      JFIF_IDENTIFIER.every((byte, index) => payload[index] === byte) &&
      !this.jfifKept &&
      this.outLength === 2;
    if (bareJfif) {
      this.jfifKept = true;
      this.emit(whole);
    } else {
      this.stripped += 1;
    }
  }

  private frameHeader(marker: number, length: number, payload: Buffer): void {
    if (this.frame !== null || payload.length < 6) throw new Refused("damaged");
    const components = payload[5] ?? 0;
    if (components !== 1 && components !== 3) throw new Refused("unsupported");
    if (length !== 8 + 3 * components) throw new Refused("damaged");
    if (payload[0] !== 8) throw new Refused("unsupported");
    const height = payload.readUInt16BE(1);
    const width = payload.readUInt16BE(3);
    // A height of 0 would come from a DNL marker, which is not supported.
    if (height === 0) throw new Refused("unsupported");
    const ids: number[] = [];
    for (let index = 0; index < components; index += 1) {
      const at = 6 + 3 * index;
      const id = payload[at] ?? 0;
      const sampling = payload[at + 1] ?? 0;
      const quantiser = payload[at + 2] ?? 0;
      const horizontal = sampling >> 4;
      const vertical = sampling & 0x0f;
      if (
        ids.includes(id) ||
        horizontal < 1 ||
        horizontal > 4 ||
        vertical < 1 ||
        vertical > 4 ||
        quantiser > 3
      ) {
        throw new Refused("damaged");
      }
      ids.push(id);
    }
    // The size comes from this header only, and is checked before anything is
    // done with it: nothing is ever allocated from it.
    if (width !== height) throw new Refused("not_square");
    if (
      width < PROFILE_PICTURE_LIMITS.minSide ||
      width > PROFILE_PICTURE_LIMITS.maxSide
    ) {
      throw new Refused("wrong_size");
    }
    this.frame = {
      width,
      progressive: marker === M.SOF2,
      componentIds: ids,
    };
  }

  private scan(header: Buffer, payload: Buffer): void {
    const { frame } = this;
    if (
      frame === null ||
      !this.sawTables.quantiser ||
      !this.sawTables.huffman
    ) {
      throw new Refused("damaged");
    }
    this.scans += 1;
    if (this.scans > MAX_SCANS) throw new Refused("damaged");

    const count = payload[0] ?? 0;
    if (
      payload.length !== 4 + 2 * count ||
      count < 1 ||
      count > frame.componentIds.length
    ) {
      throw new Refused("damaged");
    }
    const used: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const selector = payload[1 + 2 * index] ?? 0;
      const tables = payload[2 + 2 * index] ?? 0;
      if (
        !frame.componentIds.includes(selector) ||
        used.includes(selector) ||
        tables >> 4 > 3 ||
        (tables & 0x0f) > 3
      ) {
        throw new Refused("damaged");
      }
      used.push(selector);
    }
    const start = payload[1 + 2 * count] ?? 0;
    const stop = payload[2 + 2 * count] ?? 0;
    const approximation = payload[3 + 2 * count] ?? 0;
    if (start > stop || stop > 63) throw new Refused("damaged");
    if (
      !frame.progressive &&
      (start !== 0 || stop !== 63 || approximation !== 0)
    ) {
      throw new Refused("damaged");
    }
    this.emit(header);

    const from = this.pos;
    const markerAt = this.endOfEntropyData(from);
    // Fill bytes just before the ending marker are dropped.
    let copyEnd = markerAt;
    while (copyEnd > from && this.data[copyEnd - 1] === 0xff) copyEnd -= 1;
    this.emit(this.data.subarray(from, copyEnd));
    this.pos = markerAt;
  }

  /**
   * The position of the FF that ends the scan: a stuffed FF 00 and a restart
   * marker belong to the data, and FF FF is fill. Without one, the file ends
   * inside the scan.
   */
  private endOfEntropyData(from: number): number {
    const { data } = this;
    let at = from;
    for (;;) {
      if (at >= data.length) throw new Refused("damaged");
      if (data[at] !== 0xff) {
        at += 1;
        continue;
      }
      const next = data[at + 1];
      if (next === undefined) throw new Refused("damaged");
      if (next === 0x00 || (next >= M.RST0 && next <= M.RST7)) {
        at += 2;
      } else if (next === 0xff) {
        at += 1;
      } else {
        return at;
      }
    }
  }
}

/** Whole tables only: a byte of Pq and Tq, then 64 values of one or two bytes each. */
function checkQuantiserTables(payload: Buffer): void {
  let at = 0;
  if (payload.length === 0) throw new Refused("damaged");
  while (at < payload.length) {
    const info = payload[at] ?? 0;
    const precision = info >> 4;
    if (precision > 1 || (info & 0x0f) > 3) throw new Refused("damaged");
    at += 1 + 64 * (precision + 1);
  }
  if (at !== payload.length) throw new Refused("damaged");
}

/** Whole tables, never more than 256 symbols, and a code space that is not overfull. */
function checkHuffmanTables(payload: Buffer): void {
  let at = 0;
  if (payload.length === 0) throw new Refused("damaged");
  while (at < payload.length) {
    if (at + 17 > payload.length) throw new Refused("damaged");
    const info = payload[at] ?? 0;
    if (info >> 4 > 1 || (info & 0x0f) > 3) throw new Refused("damaged");
    let symbols = 0;
    let space = 0;
    for (let length = 1; length <= 16; length += 1) {
      const count = payload[at + length] ?? 0;
      symbols += count;
      space += count * 2 ** (16 - length);
    }
    if (symbols > 256 || space > 65_536) throw new Refused("damaged");
    at += 17 + symbols;
  }
  if (at !== payload.length) throw new Refused("damaged");
}

/**
 * The rules of a profile picture's bytes. No Prisma and no HTTP: bytes in, a
 * verdict out. It never throws on any input.
 */
export class JpegCleaner {
  clean(input: Uint8Array): JpegVerdict {
    if (input.length === 0) return { ok: false, code: "empty" };
    if (input.length > PROFILE_PICTURE_LIMITS.maxBytes) {
      return { ok: false, code: "too_big" };
    }
    const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
    if (data.length < 4 || data[0] !== 0xff || data[1] !== M.SOI) {
      return { ok: false, code: "not_jpeg" };
    }
    try {
      return new Walk(data).run();
    } catch (error) {
      if (error instanceof Refused) return { ok: false, code: error.code };
      throw error;
    }
  }
}
