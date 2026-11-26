// A JPEG written byte by byte, with no image library. Tests of the picture
// upload need real, valid files: a flat-colour square made in code (so it is
// synthetic by construction), and crafted variants for the refusals.
//
// A flat block has only a DC coefficient, so the entropy-coded data is a few
// bits per block and the file is about 1.4 KB at 256 by 256 pixels. Nothing
// here decodes a picture.

export const SOI = Buffer.from([0xff, 0xd8]);
export const EOI = Buffer.from([0xff, 0xd9]);

/** The marker bytes the cleaner and the tests talk about. */
export const MARKER = {
  APP0: 0xe0,
  APP1: 0xe1,
  APP2: 0xe2,
  APP14: 0xee,
  COM: 0xfe,
  DQT: 0xdb,
  DHT: 0xc4,
  SOF0: 0xc0,
  SOF2: 0xc2,
  SOS: 0xda,
  DRI: 0xdd,
} as const;

/**
 * ITU T.81 Annex K.3: the standard luminance DC table. Counts of codes of
 * length 1 to 16, then the symbols (the size categories 0 to 11).
 */
export const DC_COUNTS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
export const DC_SYMBOLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** One AC symbol: 0x00, end of block, as a one-bit code. */
export const AC_COUNTS = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
export const AC_SYMBOLS = [0x00];

export interface HuffmanCode {
  readonly code: number;
  readonly length: number;
}

/** The canonical codes of a table (T.81 Annex C): derived from the counts, never typed in. */
export function canonicalCodes(
  counts: readonly number[],
  symbols: readonly number[],
): Map<number, HuffmanCode> {
  const codes = new Map<number, HuffmanCode>();
  let code = 0;
  let next = 0;
  counts.forEach((count, index) => {
    for (let i = 0; i < count; i += 1) {
      const symbol = symbols[next];
      if (symbol === undefined) throw new Error("fewer symbols than counts");
      codes.set(symbol, { code, length: index + 1 });
      code += 1;
      next += 1;
    }
    code <<= 1;
  });
  return codes;
}

/** Packs bits most significant first, stuffs a zero after every FF and pads with ones. */
class BitWriter {
  private readonly bytes: number[] = [];
  private accumulator = 0;
  private bits = 0;

  write(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.accumulator = (this.accumulator << 1) | ((value >> i) & 1);
      this.bits += 1;
      if (this.bits === 8) this.flush();
    }
  }

  finish(): Buffer {
    while (this.bits !== 0) this.write(1, 1);
    return Buffer.from(this.bytes);
  }

  private flush(): void {
    this.bytes.push(this.accumulator);
    if (this.accumulator === 0xff) this.bytes.push(0x00);
    this.accumulator = 0;
    this.bits = 0;
  }
}

/** The size category of a DC difference: the number of bits of its magnitude. */
export function dcCategory(difference: number): number {
  return difference === 0 ? 0 : 32 - Math.clz32(Math.abs(difference));
}

function u16(value: number): Buffer {
  return Buffer.from([(value >> 8) & 0xff, value & 0xff]);
}

/**
 * A segment: FF, the marker, a 16-bit length that counts itself, the payload.
 * `declaredLength` writes a length that is not the real one, for the files that
 * must be refused.
 */
export function segment(
  marker: number,
  payload: Uint8Array,
  declaredLength?: number,
): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, marker]),
    u16(declaredLength ?? payload.length + 2),
    payload,
  ]);
}

/** Joins parts into one file. Add `SOI` and `EOI` yourself: a crafted file may leave one out. */
export function jpeg(...parts: Uint8Array[]): Buffer {
  return Buffer.concat(parts);
}

/** A frame header (SOF0 or SOF2) with the size and components you choose. */
export function frameWith(
  width: number,
  height: number,
  components: number,
  marker: number = MARKER.SOF0,
): Buffer {
  const list: number[] = [];
  for (let id = 1; id <= components; id += 1) list.push(id, 0x11, 0);
  return segment(
    marker,
    Buffer.concat([
      Buffer.from([8]),
      u16(height),
      u16(width),
      Buffer.from([components, ...list]),
    ]),
  );
}

/** An APP1 holding a made-up EXIF block, with a recognisable text where a GPS position would be. */
export function exif(withGps: boolean): Buffer {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
  ]);
  const gps = withGps
    ? Buffer.from("GPSLatitude=1.3000N;GPSLongitude=103.8E")
    : Buffer.alloc(0);
  return segment(
    MARKER.APP1,
    Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, gps]),
  );
}

export function comment(text: string): Buffer {
  return segment(MARKER.COM, Buffer.from(text, "latin1"));
}

/** The 16-byte JFIF APP0 a browser canvas writes. */
export function jfifApp0(): Buffer {
  return segment(
    MARKER.APP0,
    Buffer.from([
      0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
      0x00, 0x00,
    ]),
  );
}

export interface FlatJpegOptions {
  /** Pixels on each side. A multiple of 8. */
  readonly side?: number;
  /** 3 for colour, 1 for grey. */
  readonly components?: 1 | 3;
  readonly y?: number;
  readonly cb?: number;
  readonly cr?: number;
  readonly jfif?: boolean;
}

/** The pieces of a flat file, so a test can put its own segment between them. */
export interface FlatJpegParts {
  readonly app0: Buffer;
  readonly dqt: Buffer;
  readonly sof: Buffer;
  readonly dht: Buffer;
  readonly sos: Buffer;
  /** The entropy-coded data, with its FF 00 stuffing, before the end marker. */
  readonly scan: Buffer;
}

function tableSegment(
  tableClassAndId: number,
  counts: readonly number[],
  symbols: readonly number[],
): Buffer {
  return Buffer.from([tableClassAndId, ...counts, ...symbols]);
}

export function flatJpegParts(options: FlatJpegOptions = {}): FlatJpegParts {
  const side = options.side ?? 256;
  const components = options.components ?? 3;
  const values = [options.y ?? 200, options.cb ?? 100, options.cr ?? 160].slice(
    0,
    components,
  );
  if (side % 8 !== 0 || side < 8)
    throw new Error("side must be a multiple of 8");

  const dc = canonicalCodes(DC_COUNTS, DC_SYMBOLS);
  const ac = canonicalCodes(AC_COUNTS, AC_SYMBOLS);
  const endOfBlock = ac.get(0x00);
  if (endOfBlock === undefined) throw new Error("no end-of-block code");

  const writer = new BitWriter();
  const previous = values.map(() => 0);
  const mcus = (side / 8) * (side / 8);
  for (let mcu = 0; mcu < mcus; mcu += 1) {
    values.forEach((value, component) => {
      // The quantiser is 1, so the DC coefficient is 8 * (value - 128).
      const target = 8 * (value - 128);
      const difference = target - (previous[component] ?? 0);
      previous[component] = target;
      const size = dcCategory(difference);
      const code = dc.get(size);
      if (code === undefined) throw new Error("no DC code for the size");
      writer.write(code.code, code.length);
      if (size > 0) {
        const extra =
          difference < 0 ? difference + (1 << size) - 1 : difference;
        writer.write(extra, size);
      }
      writer.write(endOfBlock.code, endOfBlock.length);
    });
  }

  const ids = values.map((_, index) => index + 1);
  const quantiser = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)]);
  const sosPayload = Buffer.from([
    components,
    ...ids.flatMap((id) => [id, 0x00]),
    0,
    63,
    0,
  ]);
  return {
    app0: options.jfif === false ? Buffer.alloc(0) : jfifApp0(),
    dqt: segment(MARKER.DQT, quantiser),
    sof: frameWith(side, side, components),
    dht: segment(
      MARKER.DHT,
      Buffer.concat([
        tableSegment(0x00, DC_COUNTS, DC_SYMBOLS),
        tableSegment(0x10, AC_COUNTS, AC_SYMBOLS),
      ]),
    ),
    sos: segment(MARKER.SOS, sosPayload),
    scan: writer.finish(),
  };
}

/** A baseline (SOF0) JPEG, 4:4:4, one scan, every block a single flat colour. */
export function makeFlatJpeg(options: FlatJpegOptions = {}): Buffer {
  const parts = flatJpegParts(options);
  return jpeg(
    SOI,
    parts.app0,
    parts.dqt,
    parts.sof,
    parts.dht,
    parts.sos,
    parts.scan,
    EOI,
  );
}

/**
 * A copy with the frame marker changed from SOF0 to SOF2. Structure only: it
 * is not a decodable progressive picture. It exists to prove that the cleaner
 * accepts a progressive frame header.
 */
export function markedProgressive(bytes: Uint8Array): Buffer {
  const copy = Buffer.from(bytes);
  let position = 2;
  while (position + 4 <= copy.length) {
    const marker = copy[position + 1];
    if (copy[position] !== 0xff || marker === undefined) break;
    if (marker === MARKER.SOF0) {
      copy[position + 1] = MARKER.SOF2;
      return copy;
    }
    position += 2 + copy.readUInt16BE(position + 2);
  }
  throw new Error("no baseline frame header to mark");
}
