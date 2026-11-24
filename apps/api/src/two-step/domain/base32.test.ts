import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32 } from "./base32.js";

const VECTORS: [string, string][] = [
  ["", ""],
  ["f", "MY"],
  ["fo", "MZXQ"],
  ["foo", "MZXW6"],
  ["foob", "MZXW6YQ"],
  ["fooba", "MZXW6YTB"],
  ["foobar", "MZXW6YTBOI"],
];

describe("base32", () => {
  it("encodes the RFC 4648 test vectors without padding", () => {
    for (const [plain, encoded] of VECTORS) {
      expect(encodeBase32(Buffer.from(plain))).toBe(encoded);
    }
  });

  it("decodes them back and ignores case, spaces and padding", () => {
    for (const [plain, encoded] of VECTORS) {
      expect(decodeBase32(encoded)?.toString()).toBe(plain);
      expect(decodeBase32(encoded.toLowerCase())?.toString()).toBe(plain);
    }
    expect(decodeBase32("MZXW 6YTB")?.toString()).toBe("fooba");
    expect(decodeBase32("MZXW6YQ=")?.toString()).toBe("foob");
    expect(decodeBase32("MZXW6===")?.toString()).toBe("foo");
  });

  it("refuses a character outside the alphabet", () => {
    expect(decodeBase32("MZXW1")).toBeNull();
    expect(decodeBase32("MZXW-6")).toBeNull();
    expect(decodeBase32("MZXW8")).toBeNull();
  });

  it("round-trips twenty bytes", () => {
    const bytes = Buffer.from(
      Array.from({ length: 20 }, (_, i) => (i * 37 + 11) & 255),
    );
    const encoded = encodeBase32(bytes);
    expect(encoded).toHaveLength(32);
    expect(decodeBase32(encoded)?.equals(bytes)).toBe(true);
  });
});
