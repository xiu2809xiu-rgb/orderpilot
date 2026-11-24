import { describe, expect, it } from "vitest";
import { SecretBox, deriveKey } from "./secret-box.js";

const SECRET = "unit-test-secret-unit-test-secret-1234";
const box = new SecretBox(deriveKey(SECRET));
const alice = "00000000-0000-7000-8000-00000000000a";
const bob = "00000000-0000-7000-8000-00000000000b";
const plain = Buffer.from("12345678901234567890");

describe("SecretBox", () => {
  it("opens what it sealed", () => {
    expect(box.open(box.seal(plain, alice), alice)?.equals(plain)).toBe(true);
  });

  it("writes the v1 format with a fresh nonce each time", () => {
    const first = box.seal(plain, alice);
    const second = box.seal(plain, alice);
    expect(first).not.toBe(second);
    for (const sealed of [first, second]) {
      const parts = sealed.split(".");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("v1");
      expect(Buffer.from(parts[1] ?? "", "base64url")).toHaveLength(12);
      expect(Buffer.from(parts[3] ?? "", "base64url")).toHaveLength(16);
    }
    expect(first.split(".")[1]).not.toBe(second.split(".")[1]);
  });

  it("refuses a ciphertext moved to another user", () => {
    expect(box.open(box.seal(plain, alice), bob)).toBeNull();
  });

  it("refuses a changed byte", () => {
    const [version, nonce, body, tag] = box.seal(plain, alice).split(".");
    const flipped = Buffer.from(body ?? "", "base64url");
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(
      box.open(
        [version, nonce, flipped.toString("base64url"), tag].join("."),
        alice,
      ),
    ).toBeNull();
  });

  it("refuses text that is not the v1 format", () => {
    expect(box.open("", alice)).toBeNull();
    expect(box.open("v2.a.b.c", alice)).toBeNull();
    expect(box.open(`${box.seal(plain, alice)}.extra`, alice)).toBeNull();
    expect(box.open("v1.AA.AA.AA", alice)).toBeNull();
  });

  it("refuses a key derived from another secret", () => {
    const other = new SecretBox(
      deriveKey("another-secret-another-secret-123456"),
    );
    expect(other.open(box.seal(plain, alice), alice)).toBeNull();
  });

  it("derives the same key for the same secret and label", () => {
    expect(deriveKey(SECRET).equals(deriveKey(SECRET))).toBe(true);
    expect(deriveKey(SECRET)).toHaveLength(32);
    expect(deriveKey(SECRET).equals(deriveKey(`${SECRET}x`))).toBe(false);
  });
});
